from django_filters import rest_framework as filters
from .models import Task


class TaskFilter(filters.FilterSet):
    """Фильтры для задач"""
    
    min_due_date = filters.DateTimeFilter(field_name='due_date', lookup_expr='gte')
    max_due_date = filters.DateTimeFilter(field_name='due_date', lookup_expr='lte')
    created_after = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    overdue = filters.BooleanFilter(method='filter_overdue')
    
    class Meta:
        model = Task
        fields = {
            'status': ['exact'],
            'priority': ['exact'],
            'project': ['exact'],
            'assignee': ['exact'],
            'creator': ['exact'],
        }
    
    def filter_overdue(self, queryset, name, value):
        """Фильтр просроченных задач"""
        from django.utils import timezone
        if value:
            return queryset.filter(
                due_date__lt=timezone.now()
            ).exclude(status__in=['done', 'cancelled'])
        return queryset