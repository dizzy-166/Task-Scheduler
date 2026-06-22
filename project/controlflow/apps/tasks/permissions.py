# apps/tasks/permissions.py
from rest_framework import permissions

from apps.companies.utils import has_company_permission


class CanManageTask(permissions.BasePermission):
    """Проверка прав на управление задачами с учётом кастомных ролей."""

    def _check_permission(self, request, permission_code):
        """Есть ли у пользователя разрешение в текущей компании."""
        user = request.user
        if not user.is_authenticated:
            return False

        company_id = request.headers.get('X-Company-Id')
        if not company_id:
            # Без компании разрешаем только личные действия
            return permission_code in ['tasks.create', 'tasks.edit_own']

        return has_company_permission(user, company_id, permission_code)

    def has_permission(self, request, view):
        """Проверка на уровне запроса (list, create)."""
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
        """Проверка на уровне объекта (update, delete, custom actions)."""
        user = request.user

        # GET запросы разрешены
        if request.method in permissions.SAFE_METHODS:
            return True

        # Обновление задачи
        if view.action in ['update', 'partial_update']:
            if self._check_permission(request, 'tasks.edit_any'):
                return True
            if self._check_permission(request, 'tasks.edit_own'):
                return obj.creator == user
            return False

        # Удаление задачи
        if view.action == 'destroy':
            return self._check_permission(request, 'tasks.delete_any')

        # Назначение исполнителя
        if view.action == 'assign':
            return self._check_permission(request, 'tasks.assign')

        # Изменение статуса/колонки — детальные правила workflow проверяет
        # сам метод change_status (единый источник правды).
        if view.action == 'change_status':
            return True

        # Таймер, комментарии, подзадачи — разрешены любому участнику
        if view.action in ['start_timer', 'stop_timer', 'active_timer', 'comments', 'delete_comment', 'subtasks']:
            return True

        return False
