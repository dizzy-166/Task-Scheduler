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
        if user.is_admin:
            return True
        
        # Менеджер может управлять задачами своего отдела
        if user.is_manager:
            # Задача принадлежит проекту менеджера
            if obj.project and obj.project.manager_id == user.id:
                return True
            # Задача принадлежит подчинённому
            if obj.assignee and obj.assignee.manager_id == user.id:
                return True
            # Создатель задачи - менеджер
            if obj.creator_id == user.id:
                return True
        
        # Исполнитель может просматривать и обновлять свои задачи
        if obj.assignee_id == user.id:
            # GET, PUT, PATCH - разрешены для исполнителя
            if request.method in permissions.SAFE_METHODS or request.method in ['PUT', 'PATCH']:
                return True
        
        # Создатель задачи может её редактировать
        if obj.creator_id == user.id:
            return True
        
        # Наблюдатель может только просматривать
        if user.is_observer and request.method in permissions.SAFE_METHODS:
            return True
        
        return False