"""Единая точка проверки прав в контексте компании.

Раньше логика «owner/admin могут всё, иначе смотрим кастомные роли» была
скопирована в tasks/views.py, tasks/permissions.py, core/views.py и
companies/views.py. Теперь все проверки идут через эти функции.
"""
from django.db.models import Q
from django.utils import timezone


def company_membership(user, company_id):
    """Активное членство пользователя в компании или None."""
    if not user or not getattr(user, 'is_authenticated', False) or not company_id:
        return None
    from .models import CompanyMember
    return CompanyMember.objects.filter(
        company_id=company_id, user=user, status='active'
    ).first()


def has_company_permission(user, company_id, code):
    """Может ли пользователь выполнить действие `code` в компании.

    owner/admin имеют все права. Иначе ищем активную (неистёкшую) кастомную
    роль, в которой это разрешение выдано (granted=True).
    """
    membership = company_membership(user, company_id)
    if membership is None:
        return False
    if membership.role in ('owner', 'admin'):
        return True

    from apps.users.models import UserRole
    return UserRole.objects.filter(
        user=user,
        role__context_type='company',
        role__context_id=company_id,
        role__permissions__permission__code=code,
        role__permissions__granted=True,
    ).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
    ).exists()


def company_permission_codes(user, company_id):
    """Набор кодов прав пользователя в компании — для отдачи на фронт.

    owner/admin → все существующие коды. Иначе — объединение прав всех его
    активных (неистёкших) ролей в этой компании.
    """
    membership = company_membership(user, company_id)
    if membership is None:
        return set()

    from apps.users.models import Permission, UserRole
    if membership.role in ('owner', 'admin'):
        return set(Permission.objects.values_list('code', flat=True))

    return set(
        UserRole.objects.filter(
            user=user,
            role__context_type='company',
            role__context_id=company_id,
            role__permissions__granted=True,
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        ).values_list('role__permissions__permission__code', flat=True)
    )
