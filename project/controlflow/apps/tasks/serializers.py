from rest_framework import serializers
from django.utils import timezone
from .models import Task
from apps.users.serializers import UserSerializer


class TaskListSerializer(serializers.ModelSerializer):
    """Упрощённый сериализатор для списка задач"""
    
    assignee_name = serializers.SerializerMethodField()
    creator_name = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'project_name', 'project',
            'assignee_name', 'assignee', 'creator_name', 'creator',
            'status', 'status_display', 'priority', 'priority_display',
            'due_date', 'estimated_hours', 'actual_hours', 'created_at'
        ]

    def get_assignee_name(self, obj):
        return obj.assignee.full_name if obj.assignee else 'Не назначен'

    def get_creator_name(self, obj):
        return obj.creator.full_name if obj.creator else ''

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ''


class TaskDetailSerializer(serializers.ModelSerializer):
    """Детальный сериализатор для задачи"""
    
    assignee_detail = UserSerializer(source='assignee', read_only=True)
    creator_detail = UserSerializer(source='creator', read_only=True)
    assignee_name = serializers.SerializerMethodField()
    creator_name = serializers.SerializerMethodField()
    project_name = serializers.SerializerMethodField()
    parent_task_title = serializers.SerializerMethodField()
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    time_left = serializers.CharField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'project', 'project_name',
            'creator', 'creator_name', 'creator_detail',
            'assignee', 'assignee_name', 'assignee_detail',
            'parent_task', 'parent_task_title',
            'status', 'status_display', 'priority', 'priority_display',
            'start_date', 'due_date', 'completed_at',
            'estimated_hours', 'actual_hours',
            'time_left', 'is_overdue',
            'created_at', 'updated_at', 'deleted_at'
        ]
        read_only_fields = ['id', 'creator', 'created_at', 'updated_at', 'completed_at']

    def get_assignee_name(self, obj):
        return obj.assignee.full_name if obj.assignee else 'Не назначен'

    def get_creator_name(self, obj):
        return obj.creator.full_name if obj.creator else ''

    def get_project_name(self, obj):
        return obj.project.name if obj.project else ''

    def get_parent_task_title(self, obj):
        return obj.parent_task.title if obj.parent_task else ''


class TaskCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания задачи"""
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'project', 'assignee',
            'parent_task', 'priority', 'status',
            'start_date', 'due_date', 'estimated_hours'
        ]
    
    def validate_due_date(self, value):
        """Проверка, что дедлайн не в прошлом"""
        if value and value < timezone.now():
            raise serializers.ValidationError('Дедлайн не может быть в прошлом')
        return value
    
    def validate_estimated_hours(self, value):
        """Проверка, что оценка времени положительная"""
        if value and value <= 0:
            raise serializers.ValidationError('Оценка времени должна быть положительной')
        return value
    
    def create(self, validated_data):
        """Создание задачи с автоматической установкой создателя"""
        validated_data['creator'] = self.context['request'].user
        return super().create(validated_data)


class TaskUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для обновления задачи"""
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'project', 'assignee',
            'parent_task', 'priority', 'status',
            'start_date', 'due_date', 'estimated_hours', 'actual_hours'
        ]
    
    def update(self, instance, validated_data):
        """Обновление задачи с записью истории"""
        old_status = instance.status
        new_status = validated_data.get('status', old_status)
        
        # Если задача завершается, устанавливаем дату завершения
        if new_status == 'done' and old_status != 'done':
            validated_data['completed_at'] = timezone.now()
        elif new_status != 'done' and old_status == 'done':
            validated_data['completed_at'] = None
        
        return super().update(instance, validated_data)