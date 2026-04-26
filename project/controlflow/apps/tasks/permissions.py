from rest_framework import permissions


class CanManageTask(permissions.BasePermission):
    """Права на управление задачами"""
    
    def has_permission(self, request, view):
        """Проверка на уровне запроса"""
        return request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Проверка на уровне объекта"""
        user = request.user
        
        # Админ может всё
        if user.role == 'admin':
            return True
        
        # Проверяем, является ли пользователь участником компании задачи
        is_company_member = False
        if obj.company_id:
            from apps.companies.models import CompanyMember
            is_company_member = CompanyMember.objects.filter(
                company_id=obj.company_id,
                user=user,
                status='active'
            ).exists()
        
        # Участники компании могут просматривать задачи своей компании
        if is_company_member and request.method in permissions.SAFE_METHODS:
            return True
        
        # Менеджер может управлять задачами своего отдела
        if user.role == 'manager':
            if obj.project and obj.project.manager_id == user.id:
                return True
            if obj.assignee and obj.assignee.manager_id == user.id:
                return True
            if obj.creator_id == user.id:
                return True
        
        # Исполнитель может просматривать и обновлять свои задачи
        if obj.assignee_id == user.id:
            if request.method in permissions.SAFE_METHODS or request.method in ['PUT', 'PATCH']:
                return True
        
        # Создатель задачи может всё
        if obj.creator_id == user.id:
            return True
        
        # Наблюдатель может только просматривать
        if user.role == 'observer' and request.method in permissions.SAFE_METHODS:
            return True
        
        return False