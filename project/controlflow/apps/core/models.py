import uuid
from django.db import models
from django.utils import timezone


class Project(models.Model):
    """Модель проекта"""
    
    STATUS_CHOICES = [
        ('active', 'Активный'),
        ('completed', 'Завершён'),
        ('on_hold', 'Приостановлен'),
        ('cancelled', 'Отменён'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('Название', max_length=200)
    description = models.TextField('Описание', blank=True, null=True)
    code = models.CharField('Код проекта', max_length=50, unique=True, blank=True, null=True)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default='active')
    
    # Связи с пользователями
    owner = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='owned_projects',
        verbose_name='Владелец'
    )
    manager = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_projects',
        verbose_name='Менеджер'
    )
    
    # Даты
    start_date = models.DateField('Дата начала', null=True, blank=True)
    end_date = models.DateField('Дата окончания', null=True, blank=True)
    deadline = models.DateField('Дедлайн', null=True, blank=True)
    
    # Мягкое удаление
    deleted_at = models.DateTimeField('Удалён', null=True, blank=True)
    
    # Системные поля
    created_at = models.DateTimeField('Создан', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)
    
    class Meta:
        db_table = 'projects'
        verbose_name = 'Проект'
        verbose_name_plural = 'Проекты'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['owner']),
            models.Index(fields=['manager']),
            models.Index(fields=['deadline']),
            models.Index(fields=['deleted_at']),
        ]
    
    def __str__(self):
        return self.name
    
    @property
    def is_active(self):
        return self.status == 'active' and not self.deleted_at
    
    def soft_delete(self):
        """Мягкое удаление"""
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])
    
    def restore(self):
        """Восстановление"""
        self.deleted_at = None
        self.save(update_fields=['deleted_at'])