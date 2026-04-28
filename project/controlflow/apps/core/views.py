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

    def _require_admin(self, action_label):
        company_id = self.get_company_id()
        user = self.request.user
        from apps.companies.models import CompanyMember
        try:
            membership = CompanyMember.objects.get(
                company_id=company_id, user=user, status='active'
            )
        except CompanyMember.DoesNotExist:
            raise PermissionDenied('Вы не являетесь участником этой компании')
        if membership.role not in ['owner', 'admin']:
            raise PermissionDenied(f'Только владелец или администратор может {action_label}')
        return company_id

    def perform_create(self, serializer):
        company_id = self._require_admin('создавать проекты')
        serializer.save(owner=self.request.user, company_id=company_id)

    def perform_update(self, serializer):
        self._require_admin('редактировать проекты')
        serializer.save()

    def perform_destroy(self, instance):
        self._require_admin('удалять проекты')
        instance.soft_delete()
