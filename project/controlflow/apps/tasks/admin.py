from django.contrib import admin
from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'priority', 'assignee', 'creator', 'due_date', 'created_at']
    list_filter = ['status', 'priority', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    fieldsets = (
        ('Основная информация', {
            'fields': ('id', 'title', 'description', 'project', 'parent_task')
        }),
        ('Назначение', {
            'fields': ('creator', 'assignee')
        }),
        ('Статус и приоритет', {
            'fields': ('status', 'priority')
        }),
        ('Даты и время', {
            'fields': ('start_date', 'due_date', 'completed_at')
        }),
        ('Оценка времени', {
            'fields': ('estimated_hours', 'actual_hours')
        }),
        ('Системные поля', {
            'fields': ('created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )