# apps/tasks/views.py (обновленная версия)
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
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
    
    def get_queryset(self):
        """Получение задач с учётом прав пользователя и компании"""
        user = self.request.user
        queryset = Task.objects.filter(deleted_at__isnull=True)
        
        # Фильтрация по компании (если указана в заголовке)
        company_id = self.request.headers.get('X-Company-Id')
        if company_id:
            queryset = queryset.filter(company_id=company_id)
        
        # Админ видит все задачи
        if user.is_admin:
            return queryset.select_related('project', 'assignee', 'creator', 'company')
        
        # Менеджер видит задачи своего отдела и подчинённых
        if user.is_manager:
            subordinates_ids = [u.id for u in user.get_subordinates_tree()]
            return queryset.filter(
                django_models.Q(assignee_id=user.id) |
                django_models.Q(creator_id=user.id) |
                django_models.Q(assignee_id__in=subordinates_ids) |
                django_models.Q(project__manager_id=user.id)
            ).select_related('project', 'assignee', 'creator', 'company')
        
        # Исполнитель и наблюдатель видят только свои задачи
        return queryset.filter(
            django_models.Q(assignee_id=user.id) |
            django_models.Q(creator_id=user.id)
        ).select_related('project', 'assignee', 'creator', 'company')
    
    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия"""
        if self.action == 'create':
            return TaskCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TaskUpdateSerializer
        elif self.action in ['list', 'my_tasks', 'created_by_me', 'overdue']:
            return TaskListSerializer
        return TaskDetailSerializer
    
    def perform_create(self, serializer):
        """Создание задачи с логированием и привязкой к компании"""
        from apps.activity.utils import log_activity
        
        # Получаем company_id из заголовка
        company_id = self.request.headers.get('X-Company-Id')
        extra_fields = {'creator': self.request.user}
        
        if company_id:
            extra_fields['company_id'] = company_id
        
        task = serializer.save(**extra_fields)
        
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
        """Обновление задачи с логированием изменений"""
        from apps.activity.utils import log_activity
        
        old_task = self.get_object()
        task = serializer.save()
        
        # Логируем изменения
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
        """Мягкое удаление задачи"""
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
        new_status = request.data.get('status')
        
        if new_status not in dict(Task.STATUS_CHOICES):
            return Response(
                {'error': 'Неверный статус'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
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
        assignee_id = request.data.get('assignee_id')
        
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
        tasks = self.get_queryset().filter(assignee=request.user)
        page = self.paginate_queryset(tasks)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='created_by_me')
    def created_by_me(self, request):
        """Задачи, созданные мной"""
        tasks = self.get_queryset().filter(creator=request.user)
        page = self.paginate_queryset(tasks)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(tasks, many=True)
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