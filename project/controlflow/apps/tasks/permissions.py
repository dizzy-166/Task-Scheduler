from rest_framework import permissions


class CanManageTask(permissions.BasePermission):
    """Права на управление задачами"""

    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.is_superuser:
            return True

        # Проверяем роль в компании задачи
        company_role = None
        if obj.company_id:
            from apps.companies.models import CompanyMember
            membership = CompanyMember.objects.filter(
                company_id=obj.company_id, user=user, status='active'
            ).first()
            if membership:
                company_role = membership.role
                # Любой участник компании может просматривать
                if request.method in permissions.SAFE_METHODS:
                    return True

        # Владелец/админ компании может всё
        if company_role in ['owner', 'admin']:
            return True

        # Менеджер проекта может управлять задачами проекта
        if obj.project and obj.project.manager_id == user.id:
            return True

        # Исполнитель может просматривать и обновлять свои задачи
        if obj.assignee_id == user.id:
            if request.method in permissions.SAFE_METHODS or request.method in ['PUT', 'PATCH']:
                return True

        # Создатель задачи может всё
        if obj.creator_id == user.id:
            return True

        return False