import uuid
from django.db import models
from django.utils import timezone


class Task(models.Model):
    """Модель задачи"""
    
    STATUS_CHOICES = [
        ('new', 'Новая'),
        ('in_progress', 'В работе'),
        ('review', 'На проверке'),
        ('done', 'Завершена'),
        ('cancelled', 'Отменена'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Низкий'),
        ('medium', 'Средний'),
        ('high', 'Высокий'),
        ('critical', 'Критический'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField('Название', max_length=255)
    description = models.TextField('Описание', blank=True, null=True)
    
    # Связи
    project = models.ForeignKey(
        'core.Project',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tasks',
        verbose_name='Проект'
    )
    creator = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='created_tasks',
        verbose_name='Создатель'
    )
    assignee = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks',
        verbose_name='Исполнитель'
    )
    parent_task = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subtasks',
        verbose_name='Родительская задача'
    )
    
    # Статусы и приоритеты
    status = models.CharField(
        'Статус',
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        db_index=True
    )
    priority = models.CharField(
        'Приоритет',
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='medium',
        db_index=True
    )
    
    # Даты и время
    start_date = models.DateTimeField('Дата начала', null=True, blank=True)
    due_date = models.DateTimeField('Дедлайн', null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField('Дата завершения', null=True, blank=True)
    
    # Оценка времени
    estimated_hours = models.DecimalField(
        'Оценка времени (часы)',
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    actual_hours = models.DecimalField(
        'Фактические часы',
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Мягкое удаление
    deleted_at = models.DateTimeField('Удалён', null=True, blank=True, db_index=True)
    
    # Системные поля
    created_at = models.DateTimeField('Создан', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)
    
    class Meta:
        db_table = 'tasks'
        verbose_name = 'Задача'
        verbose_name_plural = 'Задачи'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['assignee']),
            models.Index(fields=['creator']),
            models.Index(fields=['project']),
            models.Index(fields=['due_date']),
            models.Index(fields=['deleted_at']),
            models.Index(fields=['parent_task']),
        ]
    
    def __str__(self):
        return self.title
    
    @property
    def is_overdue(self):
        """Проверка на просрочку"""
        if self.due_date and self.status not in ['done', 'cancelled']:
            return self.due_date < timezone.now()
        return False
    
    @property
    def time_left(self):
        """Оставшееся время в читаемом формате"""
        if not self.due_date or self.status in ['done', 'cancelled']:
            return None
        
        delta = self.due_date - timezone.now()
        if delta.total_seconds() <= 0:
            return 'Просрочено'
        
        days = delta.days
        hours = delta.seconds // 3600
        
        if days > 0:
            return f'{days}д {hours}ч'
        return f'{hours}ч'
    
    def soft_delete(self):
        """Мягкое удаление"""
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])
    
    def restore(self):
        """Восстановление"""
        self.deleted_at = None
        self.save(update_fields=['deleted_at'])