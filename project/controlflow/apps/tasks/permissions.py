# apps/tasks/permissions.py
from rest_framework import permissions

# Правильные импорты
from apps.companies.models import CompanyMember  # CompanyMember в companies
from apps.users.models import UserRole


class CanManageTask(permissions.BasePermission):
    """Проверка прав на управление задачами с учётом кастомных ролей"""
    
    def _check_permission(self, request, permission_code):
        """Проверка наличия разрешения у пользователя в текущей компании"""
        user = request.user
        company_id = request.headers.get('X-Company-Id')
        
        if not user.is_authenticated:
            return False
        
        if not company_id:
            # Без компании разрешаем только личные действия
            return permission_code in ['tasks.create', 'tasks.edit_own']
        
        # Проверяем членство в компании
        try:
            membership = CompanyMember.objects.get(
                company_id=company_id,
                user=user,
                status='active'
            )
        except CompanyMember.DoesNotExist:
            return False
        
        # Владелец имеет все права
        if membership.role == 'owner':
            return True
        
        # Админ имеет все права
        if membership.role == 'admin':
            return True
        
        # Проверяем через кастомные роли
        has_permission = UserRole.objects.filter(
            user=user,
            role__context_type='company',
            role__context_id=company_id,
            role__permissions__permission__code=permission_code,
            role__permissions__granted=True,
        ).exists()
        
        return has_permission
    
    def has_permission(self, request, view):
        """Проверка на уровне запроса (list, create)"""
        if not request.user.is_authenticated:
            return False
        
        # GET запросы (list, retrieve) разрешены
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Для создания задачи проверяем право 'tasks.create'
        if view.action == 'create':
            return self._check_permission(request, 'tasks.create')
        
        # Для остальных действий проверяем позже в has_object_permission
        return True
    
    def has_object_permission(self, request, view, obj):
        """Проверка на уровне объекта (update, delete)"""
        user = request.user
        
        # GET запросы разрешены
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Обновление задачи
        if view.action in ['update', 'partial_update']:
            has_edit_any = self._check_permission(request, 'tasks.edit_any')
            has_edit_own = self._check_permission(request, 'tasks.edit_own')
            
            if has_edit_any:
                return True
            if has_edit_own:
                return obj.creator == user
            
            return False
        
        # Удаление задачи
        if view.action == 'destroy':
            return self._check_permission(request, 'tasks.delete_any')
        
        # Назначение исполнителя
        if view.action == 'assign':
            return self._check_permission(request, 'tasks.assign')
        
        # Изменение статуса
        if view.action == 'change_status':
            has_edit_any = self._check_permission(request, 'tasks.edit_any')
            has_edit_own = self._check_permission(request, 'tasks.edit_own')
            
            if has_edit_any:
                return True
            if has_edit_own:
                return obj.creator == user or obj.assignee == user
            
            return False
        
        return False