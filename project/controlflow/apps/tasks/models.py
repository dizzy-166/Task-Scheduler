# apps/tasks/models.py
import uuid
from django.db import models
from django.utils import timezone


class KanbanColumn(models.Model):
    """Колонка канбан-доски (кастомная, per-company)"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name='kanban_columns',
        verbose_name='Компания',
    )
    name = models.CharField('Название', max_length=100)
    color = models.CharField('Цвет', max_length=7, default='#6B7280')
    order = models.IntegerField('Порядок', default=0, db_index=True)
    # Если задана — при перетаскивании в эту колонку статус задачи тоже меняется
    status_key = models.CharField(
        'Ключ статуса задачи',
        max_length=20,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'kanban_columns'
        verbose_name = 'Колонка канбана'
        verbose_name_plural = 'Колонки канбана'
        ordering = ['order']

    def __str__(self):
        return f'{self.company.name} — {self.name}'

    @classmethod
    def get_or_create_defaults(cls, company):
        """Создать 4 стандартные колонки для компании, если их нет."""
        if cls.objects.filter(company=company).exists():
            return
        defaults = [
            ('К выполнению', '#6B7280', 0, 'new'),
            ('В работе',     '#2196F3', 1, 'in_progress'),
            ('На проверке',  '#FF9800', 2, 'review'),
            ('Завершено',    '#4CAF50', 3, 'done'),
        ]
        cls.objects.bulk_create([
            cls(company=company, name=name, color=color, order=order, status_key=sk)
            for name, color, order, sk in defaults
        ])


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
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tasks',
        verbose_name='Компания'
    )
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
    kanban_column = models.ForeignKey(
        'tasks.KanbanColumn',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks',
        verbose_name='Колонка канбана',
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
            models.Index(fields=['company']),
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


class TaskTimer(models.Model):
    """Активный таймер трекинга времени на задаче (один на пару user+task)"""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task       = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='active_timers')
    user       = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='active_task_timers')
    started_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'task_timers'
        unique_together = [['task', 'user']]

    def __str__(self):
        return f'{self.user} → {self.task}'


class TaskComment(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task       = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author     = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='task_comments')
    text       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'task_comments'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.author} → {self.task}'