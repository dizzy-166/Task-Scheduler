import uuid
from django.db import models
from django.utils import timezone


class Company(models.Model):
    """Модель компании"""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField('Название', max_length=255)
    description = models.TextField('Описание', blank=True, null=True)
    
    owner = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='owned_companies',
        verbose_name='Владелец'
    )
    
    deleted_at = models.DateTimeField('Удалён', null=True, blank=True, db_index=True)
    created_at = models.DateTimeField('Создан', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)
    
    class Meta:
        db_table = 'companies'
        verbose_name = 'Компания'
        verbose_name_plural = 'Компании'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['deleted_at']),
        ]
    
    def __str__(self):
        return self.name
    
    @property
    def members_count(self):
        return self.memberships.filter(status='active').count()
    
    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])
    
    def restore(self):
        self.deleted_at = None
        self.save(update_fields=['deleted_at'])


class CompanyMember(models.Model):
    """Членство пользователя в компании"""
    
    ROLE_CHOICES = [
        ('owner', 'Владелец'),
        ('admin', 'Администратор'),
        ('member', 'Участник'),
    ]
    
    STATUS_CHOICES = [
        ('invited', 'Приглашён'),
        ('active', 'Активен'),
        ('declined', 'Отклонён'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='memberships', verbose_name='Компания'
    )
    user = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, related_name='company_memberships', verbose_name='Пользователь'
    )
    
    role = models.CharField('Роль', max_length=20, choices=ROLE_CHOICES, default='member')
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default='invited')
    
    invited_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sent_invites', verbose_name='Пригласил', db_column='invited_by'
    )
    
    joined_at = models.DateTimeField('Присоединился', null=True, blank=True)
    created_at = models.DateTimeField('Создан', auto_now_add=True)
    
    class Meta:
        db_table = 'company_members'
        verbose_name = 'Участник компании'
        verbose_name_plural = 'Участники компаний'
        unique_together = [['company', 'user']]
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.company.name}"
    
    def accept_invite(self):
        self.status = 'active'
        self.joined_at = timezone.now()
        self.save(update_fields=['status', 'joined_at'])
    
    def decline_invite(self):
        self.status = 'declined'
        self.save(update_fields=['status'])