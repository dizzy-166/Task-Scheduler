import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils import timezone
from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """Кастомная модель пользователя"""
    
    ROLE_CHOICES = [
        ('admin', 'Администратор'),
        ('manager', 'Менеджер'),
        ('executor', 'Исполнитель'),
        ('observer', 'Наблюдатель'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField('Email', max_length=255, unique=True, db_index=True)
    password_hash = models.CharField(max_length=255, editable=False)
    
    first_name = models.CharField('Имя', max_length=100)
    last_name = models.CharField('Фамилия', max_length=100)
    patronymic = models.CharField('Отчество', max_length=100, blank=True, null=True)
    
    phone = models.CharField('Телефон', max_length=20, blank=True, null=True)
    avatar_url = models.TextField('URL аватара', blank=True, null=True)
    
    role = models.CharField(
        'Роль',
        max_length=20,
        choices=ROLE_CHOICES,
        default='executor',
        db_index=True
    )
    
    manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subordinates',
        verbose_name='Руководитель',
        db_index=True
    )
    
    # Обязательные поля для Django admin
    is_active = models.BooleanField('Активен', default=True)
    is_verified = models.BooleanField('Верифицирован', default=False)
    is_staff = models.BooleanField('Доступ в админку', default=False)
    is_superuser = models.BooleanField('Суперпользователь', default=False)
    
    deleted_at = models.DateTimeField('Удалён', null=True, blank=True, db_index=True)
    last_login = models.DateTimeField('Последний вход', null=True, blank=True)
    
    yandex_id = models.CharField('Yandex ID', max_length=100, blank=True, null=True)
    google_id = models.CharField('Google ID', max_length=100, blank=True, null=True)
    
    created_at = models.DateTimeField('Создан', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
    
    @property
    def password(self):
        return self.password_hash
    
    @password.setter
    def password(self, value):
        self.password_hash = value
    
    @property
    def full_name(self):
        parts = [self.last_name, self.first_name]
        if self.patronymic:
            parts.append(self.patronymic)
        return ' '.join(parts)
    
    @property
    def short_name(self):
        return f"{self.last_name} {self.first_name[0]}."
    
    @property
    def is_admin(self):
        return self.role == 'admin'
    
    @property
    def is_manager(self):
        return self.role == 'manager'
    
    @property
    def is_executor(self):
        return self.role == 'executor'
    
    @property
    def is_observer(self):
        return self.role == 'observer'
    
    def soft_delete(self):
        """Мягкое удаление пользователя"""
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=['deleted_at', 'is_active'])
    
    def restore(self):
        """Восстановление пользователя"""
        self.deleted_at = None
        self.is_active = True
        self.save(update_fields=['deleted_at', 'is_active'])
    
    def get_subordinates_tree(self):
        """Получить всех подчинённых (рекурсивно)"""
        subordinates = []
        direct = list(self.subordinates.filter(deleted_at__isnull=True))
        subordinates.extend(direct)
        for sub in direct:
            subordinates.extend(sub.get_subordinates_tree())
        return subordinates
    
    def can_manage_user(self, user):
        """Проверка, может ли текущий пользователь управлять другим"""
        if self.is_admin:
            return True
        if self.is_manager:
            return user.manager_id == self.id or user in self.get_subordinates_tree()
        return False
    
    def has_perm(self, perm, obj=None):
        """Проверка прав (требуется для Django admin)"""
        return self.is_superuser or self.is_admin
    
    def has_module_perms(self, app_label):
        """Проверка доступа к модулю (требуется для Django admin)"""
        return self.is_superuser or self.is_admin
    
    def __str__(self):
        return f"{self.full_name} ({self.email})"