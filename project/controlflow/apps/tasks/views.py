# apps/tasks/views.py
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models as django_models
from django.db.models import Count, Sum
from django.db.models.functions import TruncWeek
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import json
import logging
import urllib.request
import urllib.error
from django.conf import settings

logger = logging.getLogger(__name__)

from .models import Task, KanbanColumn, TaskComment, TaskTimer
from .serializers import (
    TaskListSerializer, TaskDetailSerializer,
    TaskCreateSerializer, TaskUpdateSerializer,
    KanbanColumnSerializer, TaskCommentSerializer,
)
from .permissions import CanManageTask
from .filters import TaskFilter

import re
from django.contrib.auth import get_user_model
from controlflow.apps.chat.models import Notification


class TaskViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с задачами"""
    
    permission_classes = [IsAuthenticated, CanManageTask]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TaskFilter
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'due_date', 'priority', 'status', 'updated_at']
    ordering = ['-created_at']
    
    def get_company_id(self):
        return self.request.headers.get('X-Company-Id')

    def get_project_id(self):
        return self.request.headers.get('X-Project-Id')
    
    def get_queryset(self):
        """Получение задач с учётом прав пользователя, компании и проекта"""
        user = self.request.user
        company_id = self.get_company_id()
        project_id = self.get_project_id()
        queryset = Task.objects.filter(deleted_at__isnull=True)
        
        # Всегда загружаем связанные объекты для производительности
        queryset = queryset.select_related(
            'project', 'assignee', 'creator', 'company', 'parent_task'
        )
        
        # Исключаем задачи из удалённых компаний
        queryset = queryset.exclude(
            django_models.Q(company__isnull=False) & django_models.Q(company__deleted_at__isnull=False)
        )
        
        # Для my_tasks и created_by_me ищем по всем компаниям пользователя
        if self.action in ['my_tasks', 'created_by_me']:
            user_companies = user.company_memberships.filter(
                status='active'
            ).values_list('company_id', flat=True)
            queryset = queryset.filter(company_id__in=user_companies)
        elif company_id:
            # Если указана компания - фильтруем по ней
            queryset = queryset.filter(company_id=company_id)

        # Фильтрация по проекту (если выбран конкретный проект)
        if project_id and self.action not in ['my_tasks', 'created_by_me', 'stats', 'report']:
            queryset = queryset.filter(project_id=project_id)
        
        # Суперпользователь видит всё
        if user.is_superuser:
            return queryset

        # Если нет компании, показываем только свои задачи
        if not company_id:
            return queryset.filter(
                django_models.Q(assignee_id=user.id) |
                django_models.Q(creator_id=user.id)
            )
        
        # Проверяем членство в компании
        membership = user.company_memberships.filter(
            company_id=company_id, status='active'
        ).first()
        
        if not membership:
            return queryset.none()
        
        # Владелец/админ компании видит все задачи
        if membership.role in ['owner', 'admin']:
            return queryset
        
        # Проверяем кастомное право 'tasks.view_all'
        from apps.users.models import UserRole
        has_view_all = UserRole.objects.filter(
            user=user,
            role__context_type='company',
            role__context_id=company_id,
            role__permissions__permission__code='tasks.view_all',
            role__permissions__granted=True,
        ).exists()
        
        if has_view_all:
            return queryset
        
        # Иначе только свои задачи
        return queryset.filter(
            django_models.Q(assignee_id=user.id) |
            django_models.Q(creator_id=user.id)
        )
    
    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия"""
        if self.action == 'create':
            return TaskCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TaskUpdateSerializer
        elif self.action in ['list', 'my_tasks', 'created_by_me', 'overdue']:
            return TaskListSerializer
        return TaskDetailSerializer
    
    def _check_permission(self, permission_code):
        """Проверка наличия разрешения у пользователя в текущей компании"""
        user = self.request.user
        company_id = self.get_company_id()
        
        if not company_id:
            # Без компании разрешаем только личные действия
            return permission_code in ['tasks.create', 'tasks.edit_own']
        
        # Проверяем членство в компании
        try:
            from apps.companies.models import CompanyMember
            membership = CompanyMember.objects.get(
                company_id=company_id,
                user=user,
                status='active'
            )
        except CompanyMember.DoesNotExist:
            return False
        
        # Владелец имеет все права
        if membership.role == 'owner':
            return True
        
        # Админ имеет все права
        if membership.role == 'admin':
            return True
        
        # Проверяем через кастомные роли
        from apps.users.models import UserRole
        has_permission = UserRole.objects.filter(
            user=user,
            role__context_type='company',
            role__context_id=company_id,
            role__permissions__permission__code=permission_code,
            role__permissions__granted=True,
        ).exists()
        
        return has_permission
    
    def perform_create(self, serializer):
        """Создание задачи с проверкой прав и логированием"""
        from apps.activity.utils import log_activity
        
        # Проверяем право на создание задачи
        if not self._check_permission('tasks.create'):
            raise PermissionDenied('У вас нет прав на создание задач')
        
        company_id = self.get_company_id()
        
        # Создаем задачу
        task = serializer.save(
            creator=self.request.user,
            company_id=company_id if company_id else None
        )
        
        log_activity(
            user=self.request.user,
            action='task_created',
            entity_type='task',
            entity_id=str(task.id),
            details={
                'title': task.title,
                'assignee': str(task.assignee_id) if task.assignee else None,
                'company_id': str(company_id) if company_id else None
            }
        )
    
    def perform_update(self, serializer):
        """Обновление задачи с проверкой прав и логированием"""
        from apps.activity.utils import log_activity
        
        task = self.get_object()
        company_id = self.get_company_id()
        
        # Проверяем право на редактирование
        has_edit_any = self._check_permission('tasks.edit_any')
        has_edit_own = self._check_permission('tasks.edit_own')
        
        if not has_edit_any and not (has_edit_own and task.creator == self.request.user):
            raise PermissionDenied('У вас нет прав на редактирование этой задачи')
        
        old_task = Task.objects.get(id=task.id)  # Копия для сравнения
        task = serializer.save()
        
        changes = {}
        for field in ['title', 'description', 'status', 'priority', 'assignee_id']:
            old_value = getattr(old_task, field, None)
            new_value = getattr(task, field, None)
            if old_value != new_value:
                changes[field] = {'old': str(old_value), 'new': str(new_value)}
        
        if changes:
            log_activity(
                user=self.request.user,
                action='task_updated',
                entity_type='task',
                entity_id=str(task.id),
                details=changes
            )
    
    def perform_destroy(self, instance):
        """Удаление задачи с проверкой прав"""
        # Проверяем право на удаление
        if not self._check_permission('tasks.delete_any'):
            raise PermissionDenied('У вас нет прав на удаление задач')
        
        from apps.activity.utils import log_activity
        
        instance.deleted_at = timezone.now()
        instance.save()
        
        log_activity(
            user=self.request.user,
            action='task_deleted',
            entity_type='task',
            entity_id=str(instance.id),
            details={'title': instance.title}
        )
    
    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        """Изменение статуса / колонки задачи"""
        from apps.activity.utils import log_activity

        task = self.get_object()
        new_status = request.data.get('status')
        column_id = request.data.get('column_id')

        has_edit_any = self._check_permission('tasks.edit_any')
        has_edit_own = self._check_permission('tasks.edit_own')
        if not has_edit_any and not (has_edit_own and (task.creator == request.user or task.assignee == request.user)):
            raise PermissionDenied('У вас нет прав на изменение статуса этой задачи')

        old_status = task.status

        if column_id:
            try:
                column = KanbanColumn.objects.get(id=column_id)
                task.kanban_column = column
                if column.status_key:
                    new_status = column.status_key
                    task.status = new_status
                elif not new_status:
                    new_status = task.status
            except KanbanColumn.DoesNotExist:
                return Response({'error': 'Колонка не найдена'}, status=status.HTTP_400_BAD_REQUEST)
        elif new_status:
            if new_status not in dict(Task.STATUS_CHOICES):
                return Response({'error': 'Неверный статус'}, status=status.HTTP_400_BAD_REQUEST)
            task.status = new_status
        else:
            return Response({'error': 'Укажите status или column_id'}, status=status.HTTP_400_BAD_REQUEST)

        if task.status == 'done' and old_status != 'done':
            task.completed_at = timezone.now()
        elif task.status != 'done' and old_status == 'done':
            task.completed_at = None

        task.save()

        log_activity(
            user=request.user,
            action='task_status_changed',
            entity_type='task',
            entity_id=str(task.id),
            details={'old_status': old_status, 'new_status': task.status}
        )

        return Response({
            'status': task.status,
            'status_display': task.get_status_display(),
            'kanban_column': str(task.kanban_column_id) if task.kanban_column_id else None,
            'message': 'Статус обновлён',
        })
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Назначение исполнителя"""
        from apps.activity.utils import log_activity
        from apps.users.models import User
        
        task = self.get_object()
        
        # Проверяем право на назначение исполнителя
        if not self._check_permission('tasks.assign'):
            raise PermissionDenied('У вас нет прав на назначение исполнителей')
        
        assignee_id = request.data.get('assignee_id')
        
        if not assignee_id:
            return Response(
                {'error': 'Не указан исполнитель'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assignee = User.objects.get(id=assignee_id, deleted_at__isnull=True)
            task.assignee = assignee
            task.save()
            
            log_activity(
                user=request.user,
                action='task_assigned',
                entity_type='task',
                entity_id=str(task.id),
                details={'assignee': assignee.full_name}
            )
            
            return Response({
                'message': f'Исполнитель назначен: {assignee.full_name}',
                'assignee': {
                    'id': str(assignee.id),
                    'name': assignee.full_name
                }
            })
        except User.DoesNotExist:
            return Response(
                {'error': 'Пользователь не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'], url_path='my_tasks')
    def my_tasks(self, request):
        """Мои задачи (где я исполнитель)"""
        user = request.user
        queryset = Task.objects.filter(
            deleted_at__isnull=True,
            assignee=user
        ).select_related('project', 'assignee', 'creator', 'company')
        
        # Фильтруем по компании из заголовка
        company_id = self.get_company_id()
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        else:
            # Если компания не указана, ищем по всем компаниям пользователя
            user_companies = user.company_memberships.filter(
                status='active'
            ).values_list('company_id', flat=True)
            queryset = queryset.filter(company_id__in=user_companies)
        
        # Применяем фильтры (поиск, сортировку)
        queryset = self.filter_queryset(queryset)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='created_by_me')
    def created_by_me(self, request):
        """Задачи, созданные мной"""
        user = request.user
        queryset = Task.objects.filter(
            deleted_at__isnull=True,
            creator=user
        ).select_related('project', 'assignee', 'creator', 'company')
        
        company_id = self.get_company_id()
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        else:
            user_companies = user.company_memberships.filter(
                status='active'
            ).values_list('company_id', flat=True)
            queryset = queryset.filter(company_id__in=user_companies)
        
        queryset = self.filter_queryset(queryset)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Просроченные задачи"""
        tasks = self.get_queryset().filter(
            due_date__lt=timezone.now(),
            status__in=['new', 'in_progress', 'review']
        )
        page = self.paginate_queryset(tasks)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        task = self.get_object()
        if request.method == 'GET':
            qs = TaskComment.objects.filter(task=task).select_related('author')
            return Response(TaskCommentSerializer(qs, many=True).data)
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'text required'}, status=400)
        comment = TaskComment.objects.create(task=task, author=request.user, text=text)

        # Parse @mentions and notify mentioned users
        User = get_user_model()
        mentioned_names = re.findall(r'@([\w\s]+?)(?=\s@|\s*$|[^а-яёa-z\s])', text, re.IGNORECASE)
        company = task.company
        if company and mentioned_names:
            members = User.objects.filter(company_memberships__company=company).exclude(id=request.user.id)
            author_name = request.user.get_full_name() or request.user.email
            for member in members:
                full = member.get_full_name()
                if any(full.lower() == m.strip().lower() for m in mentioned_names):
                    Notification.objects.create(
                        recipient=member,
                        company=company,
                        type='comment_mention',
                        title=f'{author_name} упомянул вас в задаче «{task.title}»',
                        body=text[:200],
                        related_task=task,
                    )

        return Response(TaskCommentSerializer(comment).data, status=201)

    @action(detail=True, methods=['delete'], url_path='comments/(?P<comment_id>[^/.]+)')
    def delete_comment(self, request, pk=None, comment_id=None):
        task = self.get_object()
        try:
            comment = TaskComment.objects.get(id=comment_id, task=task)
        except TaskComment.DoesNotExist:
            return Response({'error': 'not found'}, status=404)
        if comment.author != request.user:
            return Response({'error': 'forbidden'}, status=403)
        comment.delete()
        return Response(status=204)

    # ── Timer actions ──────────────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='start_timer')
    def start_timer(self, request, pk=None):
        task = self.get_object()
        existing = TaskTimer.objects.filter(task=task, user=request.user).first()
        if existing:
            return Response({'running': True, 'started_at': existing.started_at})
        timer = TaskTimer.objects.create(task=task, user=request.user)
        return Response({'running': True, 'started_at': timer.started_at}, status=201)

    @action(detail=True, methods=['post'], url_path='stop_timer')
    def stop_timer(self, request, pk=None):
        task = self.get_object()
        timer = TaskTimer.objects.filter(task=task, user=request.user).first()
        if not timer:
            return Response({'error': 'Нет активного таймера'}, status=400)
        elapsed_seconds = (timezone.now() - timer.started_at).total_seconds()
        elapsed_hours = Decimal(str(round(elapsed_seconds / 3600, 2)))
        task.actual_hours = (task.actual_hours or Decimal('0')) + elapsed_hours
        task.save(update_fields=['actual_hours'])
        timer.delete()
        return Response({'logged_hours': float(elapsed_hours), 'actual_hours': float(task.actual_hours)})

    @action(detail=True, methods=['get'], url_path='active_timer')
    def active_timer(self, request, pk=None):
        task = self.get_object()
        timer = TaskTimer.objects.filter(task=task, user=request.user).first()
        if timer:
            return Response({'running': True, 'started_at': timer.started_at})
        return Response({'running': False, 'started_at': None})

    # ── Subtasks action ────────────────────────────────────────────────────────
    @action(detail=True, methods=['get'], url_path='subtasks')
    def subtasks(self, request, pk=None):
        task = self.get_object()
        qs = Task.objects.filter(parent_task=task, deleted_at__isnull=True).select_related(
            'assignee', 'creator', 'project', 'company'
        )
        return Response(TaskListSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Статистика по задачам"""
        queryset = self.get_queryset()
        now = timezone.now()

        # by_assignee — топ-10
        by_assignee_qs = (
            queryset.filter(assignee__isnull=False)
            .values('assignee__first_name', 'assignee__last_name', 'assignee__email')
            .annotate(
                count=Count('id'),
                actual_hours=Sum('actual_hours'),
                estimated_hours=Sum('estimated_hours'),
            )
            .order_by('-count')[:10]
        )
        by_assignee = [
            {
                'name': (
                    f"{a['assignee__first_name']} {a['assignee__last_name']}".strip()
                    or a['assignee__email']
                ),
                'count': a['count'],
                'actual_hours': float(a['actual_hours'] or 0),
                'estimated_hours': float(a['estimated_hours'] or 0),
            }
            for a in by_assignee_qs
        ]

        # by_project — топ-10
        by_project_qs = (
            queryset.filter(project__isnull=False)
            .values('project__name')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        by_project = [
            {'name': p['project__name'], 'count': p['count']}
            for p in by_project_qs
        ]

        # weekly trend — последние 8 недель (созданные задачи и выполненные)
        eight_weeks_ago = now - timedelta(weeks=8)
        created_trend = (
            queryset.filter(created_at__gte=eight_weeks_ago)
            .annotate(week=TruncWeek('created_at'))
            .values('week')
            .annotate(count=Count('id'))
            .order_by('week')
        )
        done_trend = (
            queryset.filter(status='done', updated_at__gte=eight_weeks_ago)
            .annotate(week=TruncWeek('updated_at'))
            .values('week')
            .annotate(count=Count('id'))
            .order_by('week')
        )

        def fmt_week(w):
            return w['week'].strftime('%d.%m') if w['week'] else ''

        created_map = {fmt_week(w): w['count'] for w in created_trend}
        done_map = {fmt_week(w): w['count'] for w in done_trend}
        all_weeks = sorted(set(list(created_map.keys()) + list(done_map.keys())))
        weekly_trend = [
            {'week': wk, 'created': created_map.get(wk, 0), 'done': done_map.get(wk, 0)}
            for wk in all_weeks
        ]

        totals = queryset.aggregate(
            total_actual=Sum('actual_hours'),
            total_estimated=Sum('estimated_hours'),
        )

        stats = {
            'total': queryset.count(),
            'by_status': {
                'new': queryset.filter(status='new').count(),
                'in_progress': queryset.filter(status='in_progress').count(),
                'review': queryset.filter(status='review').count(),
                'done': queryset.filter(status='done').count(),
                'cancelled': queryset.filter(status='cancelled').count(),
            },
            'by_priority': {
                'low': queryset.filter(priority='low').count(),
                'medium': queryset.filter(priority='medium').count(),
                'high': queryset.filter(priority='high').count(),
                'critical': queryset.filter(priority='critical').count(),
            },
            'overdue': queryset.filter(
                due_date__lt=now,
                status__in=['new', 'in_progress', 'review']
            ).count(),
            'total_actual_hours': float(totals['total_actual'] or 0),
            'total_estimated_hours': float(totals['total_estimated'] or 0),
            'by_assignee': by_assignee,
            'by_project': by_project,
            'weekly_trend': weekly_trend,
        }

        return Response(stats)

    @action(detail=False, methods=['get'])
    def report(self, request):
        """Детальный отчёт с фильтрами"""
        from django.db.models import Q, Avg, ExpressionWrapper, DurationField, F
        from django.db.models.functions import Coalesce

        qs  = self.get_queryset()
        now = timezone.now()

        # ── Filters ──────────────────────────────────────────────────────────
        date_from   = request.query_params.get('date_from')
        date_to     = request.query_params.get('date_to')
        project_id  = request.query_params.get('project')
        assignee_id = request.query_params.get('assignee')
        statuses    = [s.strip() for s in request.query_params.get('status', '').split(',') if s.strip()]
        priorities  = [p.strip() for p in request.query_params.get('priority', '').split(',') if p.strip()]

        if date_from:   qs = qs.filter(created_at__date__gte=date_from)
        if date_to:     qs = qs.filter(created_at__date__lte=date_to)
        if project_id:  qs = qs.filter(project_id=project_id)
        if assignee_id: qs = qs.filter(assignee_id=assignee_id)
        if statuses:    qs = qs.filter(status__in=statuses)
        if priorities:  qs = qs.filter(priority__in=priorities)

        # ── Helpers ───────────────────────────────────────────────────────────
        def _avg_days(subqs):
            if not subqs.exists():
                return None
            dur = ExpressionWrapper(
                Coalesce(F('completed_at'), F('updated_at')) - F('created_at'),
                output_field=DurationField(),
            )
            avg = subqs.annotate(dur=dur).aggregate(a=Avg('dur'))['a']
            return round(avg.total_seconds() / 86400, 1) if avg else None

        def _user_name(u):
            return (f"{u.first_name} {u.last_name}".strip()) or u.email

        # ── Summary ───────────────────────────────────────────────────────────
        total  = qs.count()
        done_n = qs.filter(status='done').count()

        summary = {
            'total':            total,
            'done':             done_n,
            'in_progress':      qs.filter(status='in_progress').count(),
            'review':           qs.filter(status='review').count(),
            'new':              qs.filter(status='new').count(),
            'cancelled':        qs.filter(status='cancelled').count(),
            'overdue':          qs.filter(due_date__lt=now, status__in=['new','in_progress','review']).count(),
            'completion_rate':  round(done_n / total * 100) if total else 0,
            'avg_completion_days': _avg_days(qs.filter(status='done')),
        }

        # ── By user ───────────────────────────────────────────────────────────
        user_rows = (
            qs.filter(assignee__isnull=False)
            .values('assignee', 'assignee__first_name', 'assignee__last_name', 'assignee__email')
            .annotate(
                total      = Count('id'),
                done       = Count('id', filter=Q(status='done')),
                in_progress= Count('id', filter=Q(status='in_progress')),
                review     = Count('id', filter=Q(status='review')),
                new        = Count('id', filter=Q(status='new')),
                overdue    = Count('id', filter=Q(due_date__lt=now, status__in=['new','in_progress','review'])),
            )
            .order_by('-total')
        )

        by_user = []
        for u in user_rows:
            t = u['total'];  d = u['done']
            name = (f"{u['assignee__first_name']} {u['assignee__last_name']}".strip()
                    or u['assignee__email'])
            avg_d = _avg_days(qs.filter(status='done', assignee_id=u['assignee']))
            by_user.append({
                'name': name, 'email': u['assignee__email'],
                'total': t, 'done': d,
                'in_progress': u['in_progress'], 'review': u['review'], 'new': u['new'],
                'overdue': u['overdue'],
                'completion_rate': round(d / t * 100) if t else 0,
                'avg_completion_days': avg_d,
            })

        # ── By project ────────────────────────────────────────────────────────
        proj_rows = (
            qs.filter(project__isnull=False)
            .values('project', 'project__name', 'project__status', 'project__deadline')
            .annotate(
                total      = Count('id'),
                done       = Count('id', filter=Q(status='done')),
                in_progress= Count('id', filter=Q(status='in_progress')),
                review     = Count('id', filter=Q(status='review')),
                new        = Count('id', filter=Q(status='new')),
                overdue    = Count('id', filter=Q(due_date__lt=now, status__in=['new','in_progress','review'])),
            )
            .order_by('-total')
        )

        by_project = []
        for p in proj_rows:
            t = p['total'];  d = p['done']
            deadline = p['project__deadline']
            by_project.append({
                'name':         p['project__name'],
                'status':       p['project__status'],
                'deadline':     deadline.strftime('%d.%m.%Y') if deadline else '—',
                'total': t, 'done': d,
                'in_progress': p['in_progress'], 'review': p['review'], 'new': p['new'],
                'overdue': p['overdue'],
                'progress_pct': round(d / t * 100) if t else 0,
            })

        # ── Task list (≤ 1000) ────────────────────────────────────────────────
        tasks = []
        for t in qs.select_related('project', 'assignee', 'creator').order_by('-created_at')[:1000]:
            assignee_name = _user_name(t.assignee) if t.assignee else '—'
            is_overdue = bool(t.due_date and t.due_date < now and t.status in ['new','in_progress','review'])
            completion_dt = t.completed_at or (t.updated_at if t.status == 'done' else None)
            tasks.append({
                'title':        t.title,
                'description':  t.description or '',
                'project':      t.project.name if t.project else '—',
                'assignee':     assignee_name,
                'creator':      _user_name(t.creator),
                'status':       t.status,
                'priority':     t.priority,
                'created_at':   t.created_at.strftime('%d.%m.%Y'),
                'due_date':     t.due_date.strftime('%d.%m.%Y') if t.due_date else '—',
                'completed_at': completion_dt.strftime('%d.%m.%Y') if completion_dt else '—',
                'is_overdue':   is_overdue,
                'estimated_hours': float(t.estimated_hours) if t.estimated_hours else None,
                'actual_hours': float(t.actual_hours) if t.actual_hours else None,
            })

        return Response({
            'generated_at': now.strftime('%d.%m.%Y %H:%M'),
            'summary':      summary,
            'by_user':      by_user,
            'by_project':   by_project,
            'tasks':        tasks,
        })


class KanbanColumnViewSet(viewsets.ModelViewSet):
    """CRUD для колонок канбан-доски"""

    permission_classes = [IsAuthenticated]
    serializer_class = KanbanColumnSerializer

    def get_company_id(self):
        return self.request.headers.get('X-Company-Id')

    def get_queryset(self):
        company_id = self.get_company_id()
        if not company_id:
            return KanbanColumn.objects.none()

        user = self.request.user
        membership = user.company_memberships.filter(
            company_id=company_id, status='active'
        ).first()
        if not membership:
            return KanbanColumn.objects.none()

        # Lazy-create defaults on first access
        from apps.companies.models import Company
        try:
            company = Company.objects.get(id=company_id)
            KanbanColumn.get_or_create_defaults(company)
        except Company.DoesNotExist:
            pass

        return KanbanColumn.objects.filter(company_id=company_id).order_by('order')

    def _require_admin(self):
        company_id = self.get_company_id()
        user = self.request.user
        from apps.companies.models import CompanyMember
        try:
            m = CompanyMember.objects.get(company_id=company_id, user=user, status='active')
        except CompanyMember.DoesNotExist:
            raise PermissionDenied('Вы не участник компании')
        if m.role not in ['owner', 'admin']:
            raise PermissionDenied('Только владелец или администратор может управлять колонками')
        return company_id

    def perform_create(self, serializer):
        company_id = self._require_admin()
        from apps.companies.models import Company
        company = Company.objects.get(id=company_id)
        # Auto-set order to last
        max_order = KanbanColumn.objects.filter(company_id=company_id).count()
        serializer.save(company=company, order=max_order)

    def perform_update(self, serializer):
        self._require_admin()
        serializer.save()

    def perform_destroy(self, instance):
        self._require_admin()
        # Move tasks in this column to None (keep their status)
        instance.tasks.update(kanban_column=None)
        instance.delete()

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """Изменить порядок колонок. Принимает [{id, order}, ...]"""
        self._require_admin()
        items = request.data.get('orders', [])
        for item in items:
            KanbanColumn.objects.filter(id=item['id']).update(order=item['order'])
        return Response({'message': 'Порядок обновлён'})


def _cerebras_generate(messages, api_key, temperature=0.6, max_tokens=1500):
    """Call Cerebras API (OpenAI-compatible) and return generated text."""
    payload = json.dumps({
        'model': 'llama-3.1-8b',
        'messages': messages,
        'temperature': temperature,
        'max_tokens': max_tokens,
    }).encode('utf-8')
    req = urllib.request.Request(
        'https://api.cerebras.ai/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode('utf-8'))
    return result['choices'][0]['message']['content']


class AIGenerateTasksView(APIView):
    """POST /api/tasks/ai-generate/ — генерация списка задач через Cerebras"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import re
        api_key = getattr(settings, 'CEREBRAS_API_KEY', None)
        if not api_key:
            return Response({'error': 'CEREBRAS_API_KEY не настроен'}, status=500)

        project_name = request.data.get('project_name', 'Проект')
        description  = request.data.get('description', '').strip()

        prompt = (
            f'Ты менеджер проектов. Создай список задач для проекта.\n\n'
            f'Проект: {project_name}\n'
            f'Описание: {description}\n\n'
            f'Верни JSON-массив из 5-8 задач. Каждая задача:\n'
            f'- title: название (до 100 символов)\n'
            f'- description: краткое описание (1-2 предложения)\n'
            f'- priority: low | medium | high | critical\n'
            f'- due_days: через сколько дней дедлайн (целое, 3-90)\n\n'
            f'Верни ТОЛЬКО JSON-массив без пояснений.\n'
            f'Пример: [{{"title":"Название","description":"Описание","priority":"medium","due_days":14}}]'
        )

        try:
            text = _cerebras_generate([{'role': 'user', 'content': prompt}], api_key)
            m = re.search(r'\[.*\]', text, re.DOTALL)
            if not m:
                logger.error('Cerebras unexpected format: %s', text[:200])
                return Response({'error': 'ИИ вернул неожиданный формат'}, status=502)
            tasks = json.loads(m.group())
            return Response({'tasks': tasks})
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8')
            logger.error('Cerebras HTTPError code=%s body=%s', e.code, body)
            return Response({'error': f'Cerebras {e.code}: {body}'}, status=502)
        except Exception as e:
            logger.error('Cerebras error: %s', e)
            return Response({'error': str(e)}, status=502)


class AIBulkCreateTasksView(APIView):
    """POST /api/tasks/ai-bulk-create/ — массовое создание задач из ИИ-ответа"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from datetime import date, timedelta

        company_id = request.headers.get('X-Company-Id')
        if not company_id:
            return Response({'error': 'X-Company-Id required'}, status=400)

        project_id = request.data.get('project_id') or None
        tasks_data = request.data.get('tasks', [])
        today = date.today()
        created = []

        for t in tasks_data:
            try:
                due_days = int(t.get('due_days', 14))
            except (TypeError, ValueError):
                due_days = 14
            task = Task.objects.create(
                company_id=company_id,
                project_id=project_id,
                creator=request.user,
                title=str(t.get('title', 'Задача'))[:200],
                description=str(t.get('description', '')),
                priority=t.get('priority', 'medium'),
                status='new',
                due_date=today + timedelta(days=due_days),
            )
            created.append({'id': str(task.id), 'title': task.title})

        return Response({'created': len(created), 'tasks': created}, status=201)


class AIAnalysisView(APIView):
    """POST /api/ai/analyze/ — анализ данных через Cerebras"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        api_key = getattr(settings, 'CEREBRAS_API_KEY', None)
        if not api_key:
            return Response({'error': 'CEREBRAS_API_KEY не настроен'}, status=500)

        stats = request.data.get('stats', {})
        company_name = request.data.get('company_name', 'Компания')

        messages = [
            {
                'role': 'system',
                'content': (
                    'Ты опытный менеджер проектов и бизнес-аналитик. '
                    'Отвечай только на русском языке, чётко и структурированно. '
                    'Используй эмодзи для наглядности. '
                    'Пиши конкретные выводы и рекомендации, не общие фразы.'
                ),
            },
            {'role': 'user', 'content': self._build_prompt(stats, company_name)},
        ]

        try:
            text = _cerebras_generate(messages, api_key, temperature=0.4, max_tokens=1024)
            return Response({'analysis': text})
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8')
            logger.error('Cerebras analysis HTTPError code=%s body=%s', e.code, body)
            return Response({'error': f'Cerebras {e.code}: {body}'}, status=502)
        except Exception as e:
            logger.error('Cerebras analysis error: %s', e)
            return Response({'error': str(e)}, status=502)

    def _build_prompt(self, stats, company_name):
        s = stats.get('summary', stats)
        by_user = stats.get('by_user', [])
        by_project = stats.get('by_project', [])

        total        = s.get('total', 0)
        done         = s.get('done', 0)
        in_progress  = s.get('in_progress', 0)
        review       = s.get('review', 0)
        new_tasks    = s.get('new', 0)
        overdue      = s.get('overdue', 0)
        rate         = s.get('completion_rate', 0)
        avg_days     = s.get('avg_completion_days', None)

        lines = [
            f'Проанализируй состояние задач компании "{company_name}".',
            f'',
            f'📊 ОБЩАЯ СТАТИСТИКА:',
            f'• Всего задач: {total}',
            f'• Завершено: {done} ({rate}%)',
            f'• В работе: {in_progress}',
            f'• На проверке: {review}',
            f'• Новые: {new_tasks}',
            f'• Просрочено: {overdue}',
        ]
        if avg_days is not None:
            lines.append(f'• Среднее время выполнения: {avg_days} дн.')

        if by_user:
            lines += ['', '👤 ПО ИСПОЛНИТЕЛЯМ:']
            for u in by_user[:8]:
                lines.append(
                    f'• {u.get("name","?")} — всего: {u.get("total",0)}, '
                    f'завершено: {u.get("done",0)}, просрочено: {u.get("overdue",0)}'
                )

        if by_project:
            lines += ['', '📁 ПО ПРОЕКТАМ:']
            for p in by_project[:8]:
                lines.append(
                    f'• {p.get("name","?")} — прогресс: {p.get("progress_pct",0)}%, '
                    f'просрочено: {p.get("overdue",0)}'
                )

        lines += [
            '',
            'Дай структурированный анализ:',
            '1. Общая оценка здоровья проекта (1-2 предложения)',
            '2. Ключевые риски (просрочки, перегруженные исполнители)',
            '3. Конкретные рекомендации (3-5 пунктов)',
        ]

        return '\n'.join(lines)
