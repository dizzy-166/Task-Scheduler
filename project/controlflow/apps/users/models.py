import uuid
import secrets
from datetime import timedelta
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


def _verification_expires():
    return timezone.now() + timedelta(hours=24)


def _reset_expires():
    return timezone.now() + timedelta(hours=1)


# ========== User Manager ==========
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_verified', True)
        
        return self.create_user(email, password, **extra_fields)


# ========== User Model ==========
class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    patronymic = models.CharField(max_length=100, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    avatar_url = models.TextField(null=True, blank=True)
    manager = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates')
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    yandex_id = models.CharField(max_length=100, null=True, blank=True)
    google_id = models.CharField(max_length=100, null=True, blank=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['deleted_at']),
            models.Index(fields=['manager']),
        ]
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
    
    @property
    def full_name(self):
        if self.patronymic:
            return f"{self.last_name} {self.first_name} {self.patronymic}"
        return f"{self.last_name} {self.first_name}"
    
    @property
    def short_name(self):
        return f"{self.last_name} {self.first_name[0]}."
    
    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=['deleted_at', 'is_active'])
    
    def restore(self):
        self.deleted_at = None
        self.is_active = True
        self.save(update_fields=['deleted_at', 'is_active'])
    
    def get_subordinates_tree(self):
        subordinates = []
        direct = list(self.subordinates.filter(deleted_at__isnull=True))
        subordinates.extend(direct)
        for sub in direct:
            subordinates.extend(sub.get_subordinates_tree())
        return subordinates
    
    def has_role(self, role_name, context_type=None, context_id=None):
        """Проверка, имеет ли пользователь конкретную роль"""
        query = UserRole.objects.filter(user=self, role__name=role_name)
        if context_type:
            query = query.filter(role__context_type=context_type)
        if context_id:
            query = query.filter(role__context_id=context_id)
        return query.exists()
    
    def has_permission(self, permission_code, context_type=None, context_id=None):
        """Проверка разрешения через SQL функцию"""
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT has_permission(%s, %s, %s, %s)",
                [self.id, permission_code, context_type, context_id]
            )
            return cursor.fetchone()[0]


# ========== Permission ==========
class Permission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=100, unique=True)
    resource = models.CharField(max_length=50)
    action = models.CharField(max_length=50)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        db_table = 'permissions'
    
    def __str__(self):
        return self.code


# ========== Role ==========
class Role(models.Model):
    CONTEXT_TYPES = [
        ('global', 'Global'),
        ('company', 'Company'),
        ('project', 'Project'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    context_type = models.CharField(max_length=20, choices=CONTEXT_TYPES)
    context_id = models.UUIDField(null=True, blank=True)
    is_system = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_roles')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'roles'
        unique_together = [['name', 'context_type', 'context_id']]
    
    def __str__(self):
        context = f"({self.context_type})" if self.context_type != 'global' else ""
        return f"{self.name}{context}"
    
    @property
    def context_object(self):
        if self.context_type == 'company' and self.context_id:
            try:
                from apps.companies.models import Company
                return Company.objects.get(id=self.context_id)
            except Company.DoesNotExist:
                return None
        return None


# ========== Role Permission ==========
class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    granted = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'role_permissions'
        unique_together = [['role', 'permission']]
    
    def __str__(self):
        return f"{self.role.name} - {self.permission.code} ({'granted' if self.granted else 'denied'})"


# ========== User Role ==========
class UserRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='users')
    granted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='granted_roles')
    granted_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'user_roles'
        unique_together = [['user', 'role']]
    
    def __str__(self):
        return f"{self.user.email} -> {self.role.name}"
    
    @property
    def is_expired(self):
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False


# ========== Email Verification Token ==========
class EmailVerificationToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verification_tokens')
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(default=_verification_expires)
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = 'email_verification_tokens'

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


# ========== Password Reset Token ==========
class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reset_tokens')
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(default=_reset_expires)
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = 'password_reset_tokens'

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at