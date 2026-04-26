from rest_framework import permissions


class IsCompanyOwnerOrAdmin(permissions.BasePermission):
    """Проверка, что пользователь владелец или админ компании"""
    
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        
        return obj.memberships.filter(
            user=request.user,
            status='active',
            role__in=['owner', 'admin']
        ).exists()


class IsCompanyMember(permissions.BasePermission):
    """Проверка, что пользователь активный участник компании"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        company_id = request.headers.get('X-Company-Id')
        if not company_id:
            return False
        
        from .models import CompanyMember
        return CompanyMember.objects.filter(
            company_id=company_id,
            user=request.user,
            status='active'
        ).exists()


class CanManageCompanyMembers(permissions.BasePermission):
    """Проверка прав на управление участниками компании"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        company_id = view.kwargs.get('pk') or request.headers.get('X-Company-Id')
        if not company_id:
            return False
        
        from .models import CompanyMember
        return CompanyMember.objects.filter(
            company_id=company_id,
            user=request.user,
            status='active',
            role__in=['owner', 'admin']
        ).exists()