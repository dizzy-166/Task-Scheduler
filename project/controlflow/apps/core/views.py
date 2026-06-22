from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from .models import Project
from .serializers import ProjectSerializer, ProjectCreateSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'name', 'status']
    ordering = ['created_at']

    def get_company_id(self):
        return self.request.headers.get('X-Company-Id')

    def get_queryset(self):
        company_id = self.get_company_id()
        if not company_id:
            return Project.objects.none()

        user = self.request.user
        membership = user.company_memberships.filter(
            company_id=company_id, status='active'
        ).first()
        if not membership:
            return Project.objects.none()

        return Project.objects.filter(
            company_id=company_id,
            deleted_at__isnull=True,
        ).order_by('created_at')

    def get_serializer_class(self):
        if self.action == 'create':
            return ProjectCreateSerializer
        return ProjectSerializer

    def _require_permission(self, code, action_label):
        """owner/admin или кастомное право `code` в текущей компании."""
        from apps.companies.utils import company_membership, has_company_permission

        company_id = self.get_company_id()
        if company_membership(self.request.user, company_id) is None:
            raise PermissionDenied('Вы не являетесь участником этой компании')
        if not has_company_permission(self.request.user, company_id, code):
            raise PermissionDenied(f'Недостаточно прав, чтобы {action_label}')
        return company_id

    def perform_create(self, serializer):
        company_id = self._require_permission('projects.create', 'создавать проекты')
        serializer.save(owner=self.request.user, company_id=company_id)

    def perform_update(self, serializer):
        self._require_permission('projects.edit', 'редактировать проекты')
        serializer.save()

    def perform_destroy(self, instance):
        self._require_permission('projects.delete', 'удалять проекты')
        from django.utils import timezone
        action = self.request.data.get('task_action', 'keep')
        if action == 'archive':
            instance.tasks.filter(deleted_at__isnull=True, archived_at__isnull=True).update(
                archived_at=timezone.now()
            )
        elif action == 'delete':
            instance.tasks.filter(deleted_at__isnull=True).update(
                deleted_at=timezone.now()
            )
        instance.soft_delete()
