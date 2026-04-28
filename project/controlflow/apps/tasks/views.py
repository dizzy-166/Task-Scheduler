# apps/tasks/views.py
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from django.db import models as django_models
from django.utils import timezone

from .models import Task
from .serializers import (
    TaskListSerializer, TaskDetailSerializer,
    TaskCreateSerializer, TaskUpdateSerializer
)
from .permissions import CanManageTask
from .filters import TaskFilter


class TaskViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с задачами"""
    
    permission_classes = [IsAuthenticated, CanManageTask]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TaskFilter
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'due_date', 'priority', 'status', 'updated_at']
    ordering = ['-created_at']
    
    def get_company_id(self):
        """Получить ID компании из заголовка"""
        return self.request.headers.get('X-Company-Id')
    
    def get_queryset(self):
        """Получение задач с учётом прав пользователя и компании"""
        user = self.request.user
        company_id = self.get_company_id()
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
        """Изменение статуса задачи"""
        from apps.activity.utils import log_activity
        
        task = self.get_object()
        company_id = self.get_company_id()
        new_status = request.data.get('status')
        
        if new_status not in dict(Task.STATUS_CHOICES):
            return Response(
                {'error': 'Неверный статус'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Проверяем права на изменение статуса
        has_edit_any = self._check_permission('tasks.edit_any')
        has_edit_own = self._check_permission('tasks.edit_own')
        
        if not has_edit_any and not (has_edit_own and (task.creator == request.user or task.assignee == request.user)):
            raise PermissionDenied('У вас нет прав на изменение статуса этой задачи')
        
        old_status = task.status
        task.status = new_status
        
        if new_status == 'done' and old_status != 'done':
            task.completed_at = timezone.now()
        elif new_status != 'done' and old_status == 'done':
            task.completed_at = None
        
        task.save()
        
        log_activity(
            user=request.user,
            action='task_status_changed',
            entity_type='task',
            entity_id=str(task.id),
            details={'old_status': old_status, 'new_status': new_status}
        )
        
        return Response({
            'status': new_status,
            'status_display': task.get_status_display(),
            'message': 'Статус обновлён'
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
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Статистика по задачам"""
        queryset = self.get_queryset()
        
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
                due_date__lt=timezone.now(),
                status__in=['new', 'in_progress', 'review']
            ).count(),
        }
        
        return Response(stats)