from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from django.utils import timezone

from apps.activity.utils import log_activity
from apps.users.models import User, Role, RolePermission, UserRole, Permission
from apps.users.serializers import (
    PermissionSerializer, RoleSerializer, RoleCreateSerializer, UserRoleSerializer
)
from .models import Company, CompanyMember
from .permissions import IsCompanyOwnerOrAdmin
from .utils import has_company_permission
from .serializers import (
    CompanySerializer,
    CompanyDetailSerializer,
    CompanyCreateSerializer,
    CompanyMemberSerializer,
    InviteMemberSerializer,
    RespondInviteSerializer,
)


class PermissionListView(generics.ListAPIView):
    """Список всех доступных разрешений"""
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Permission.objects.all().order_by('resource', 'action')


class CompanyViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с компаниями"""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Получение компаний, где пользователь активный участник"""
        user = self.request.user
        return Company.objects.filter(
            memberships__user=user,
            memberships__status='active',
            deleted_at__isnull=True
        ).distinct().select_related('owner').prefetch_related('memberships')
    
    def get_serializer_class(self):
        """Выбор сериализатора в зависимости от действия"""
        if self.action == 'create':
            return CompanyCreateSerializer
        elif self.action in ['retrieve', 'update', 'partial_update']:
            return CompanyDetailSerializer
        return CompanySerializer
    
    def perform_create(self, serializer):
        """Создание компании с логированием"""
        company = serializer.save()
        
        log_activity(
            user=self.request.user,
            action='company_created',
            entity_type='company',
            entity_id=str(company.id),
            details={'name': company.name}
        )
    
    def perform_destroy(self, instance):
        """Мягкое удаление компании - только владелец может удалить"""
        # Проверяем права - может удалить только владелец
        if instance.owner != self.request.user:
            raise PermissionDenied('Только владелец компании может её удалить')
        
        instance.soft_delete()
        
        log_activity(
            user=self.request.user,
            action='company_deleted',
            entity_type='company',
            entity_id=str(instance.id),
            details={'name': instance.name}
        )
    
    @action(detail=True, methods=['post'], url_path='invite')
    def invite_member(self, request, pk=None):
        """Приглашение пользователя в компанию"""
        company = self.get_object()

        # owner/admin или кастомное право members.invite
        if not has_company_permission(request.user, company.id, 'members.invite'):
            return Response(
                {'error': 'У вас нет прав для приглашения участников'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Назначить роль admin/owner может только владелец или администратор —
        # обладатель кастомного права members.invite не должен раздавать админку.
        from .utils import company_membership
        actor = company_membership(request.user, company.id)
        is_admin = actor is not None and actor.role in ('owner', 'admin')
        if request.data.get('role') in ('owner', 'admin') and not is_admin:
            return Response(
                {'error': 'Назначать администраторов может только владелец или администратор'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = InviteMemberSerializer(
            data=request.data,
            context={'company': company}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        user_to_invite = User.objects.get(
            email=serializer.validated_data['email'],
            deleted_at__isnull=True
        )
        
        member, created = CompanyMember.objects.get_or_create(
            company=company,
            user=user_to_invite,
            defaults={
                'role': serializer.validated_data['role'],
                'status': 'invited',
                'invited_by': request.user
            }
        )
        
        if not created and member.status == 'declined':
            member.status = 'invited'
            member.role = serializer.validated_data['role']
            member.invited_by = request.user
            member.save()
        
        log_activity(
            user=request.user,
            action='member_invited',
            entity_type='company',
            entity_id=str(company.id),
            details={
                'invited_user': str(user_to_invite.id),
                'invited_email': user_to_invite.email,
                'role': serializer.validated_data['role']
            }
        )
        
        return Response(
            CompanyMemberSerializer(member).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['get'], url_path='my_permissions')
    def my_permissions(self, request, pk=None):
        """Эффективные права текущего пользователя в компании (для фронта).

        owner/admin получают все коды; остальные — объединение прав их
        активных кастомных ролей.
        """
        from .utils import company_membership, company_permission_codes

        membership = company_membership(request.user, pk)
        if membership is None:
            return Response({'error': 'Нет доступа к компании'}, status=status.HTTP_403_FORBIDDEN)

        return Response({
            'role': membership.role,
            'permissions': sorted(company_permission_codes(request.user, pk)),
        })

    @action(detail=False, methods=['get'], url_path='invites')
    def my_invites(self, request):
        """Получение приглашений текущего пользователя"""
        members = CompanyMember.objects.filter(
            user=request.user,
            status='invited'
        ).select_related('company', 'invited_by', 'user')
        
        serializer = CompanyMemberSerializer(members, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='respond')
    def respond_invite(self, request, pk=None):
        """Ответ на приглашение (принять/отклонить)"""
        serializer = RespondInviteSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            member = CompanyMember.objects.get(
                company_id=pk,
                user=request.user,
                status='invited'
            )
        except CompanyMember.DoesNotExist:
            return Response(
                {'error': 'Приглашение не найдено'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        action = serializer.validated_data['action']
        
        if action == 'accept':
            member.accept_invite()
            
            log_activity(
                user=request.user,
                action='invite_accepted',
                entity_type='company',
                entity_id=str(member.company_id),
                details={'company_name': member.company.name}
            )
            
            return Response({
                'message': f'Вы присоединились к компании {member.company.name}',
                'member': CompanyMemberSerializer(member).data
            })
        else:
            member.decline_invite()
            
            log_activity(
                user=request.user,
                action='invite_declined',
                entity_type='company',
                entity_id=str(member.company_id),
                details={'company_name': member.company.name}
            )
            
            return Response({'message': 'Приглашение отклонено'})
    
    @action(detail=True, methods=['get'], url_path='members')
    def list_members(self, request, pk=None):
        """Получение списка активных участников компании"""
        membership = CompanyMember.objects.filter(
            company_id=pk,
            user=request.user,
            status='active'
        ).first()

        if not membership:
            return Response(
                {'error': 'У вас нет доступа к этой компании'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            company = Company.objects.get(id=pk, deleted_at__isnull=True)
        except Company.DoesNotExist:
            return Response({'error': 'Компания не найдена'}, status=status.HTTP_404_NOT_FOUND)

        members = CompanyMember.objects.filter(
            company=company,
            status='active'
        ).select_related('user', 'invited_by', 'company')

        serializer = CompanyMemberSerializer(members, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='pending')
    def list_pending(self, request, pk=None):
        """Получение списка приглашенных участников"""
        if not has_company_permission(request.user, pk, 'members.invite'):
            return Response(
                {'error': 'У вас нет прав для просмотра приглашенных'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            company = Company.objects.get(id=pk, deleted_at__isnull=True)
        except Company.DoesNotExist:
            return Response({'error': 'Компания не найдена'}, status=status.HTTP_404_NOT_FOUND)
        
        members = CompanyMember.objects.filter(
            company=company,
            status='invited'
        ).select_related('user', 'invited_by')
        
        serializer = CompanyMemberSerializer(members, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='members/(?P<user_id>[^/.]+)/change_role')
    def change_member_role(self, request, pk=None, user_id=None):
        """Изменение роли участника"""
        company = self.get_object()
        
        current_membership = CompanyMember.objects.filter(
            company=company,
            user=request.user,
            status='active',
            role__in=['owner', 'admin']
        ).first()
        
        if not current_membership:
            return Response(
                {'error': 'У вас нет прав для изменения ролей'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            member = CompanyMember.objects.get(
                company=company,
                user_id=user_id,
                status='active'
            )
        except CompanyMember.DoesNotExist:
            return Response(
                {'error': 'Участник не найден'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if member.role == 'owner':
            return Response(
                {'error': 'Нельзя изменить роль владельца'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        new_role = request.data.get('role')
        if new_role not in dict(CompanyMember.ROLE_CHOICES):
            return Response(
                {'error': 'Неверная роль'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_role = member.role
        member.role = new_role
        member.save()
        
        return Response({
            'message': f'Роль изменена с {old_role} на {new_role}',
            'member': CompanyMemberSerializer(member).data
        })
    
    @action(detail=True, methods=['post'], url_path='members/(?P<user_id>[^/.]+)/remove')
    def remove_member(self, request, pk=None, user_id=None):
        """Удаление участника из компании"""
        company = self.get_object()

        # owner/admin или кастомное право members.remove
        if not has_company_permission(request.user, company.id, 'members.remove'):
            return Response(
                {'error': 'У вас нет прав для удаления участников'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            member = CompanyMember.objects.get(
                company=company,
                user_id=user_id,
                status='active'
            )
        except CompanyMember.DoesNotExist:
            return Response(
                {'error': 'Участник не найден'},
                status=status.HTTP_404_NOT_FOUND
            )

        if member.role == 'owner':
            return Response(
                {'error': 'Нельзя удалить владельца компании'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Удалять администраторов может только владелец/администратор, а не
        # обладатель кастомного права members.remove.
        from .utils import company_membership
        actor = company_membership(request.user, company.id)
        is_admin = actor is not None and actor.role in ('owner', 'admin')
        if member.role == 'admin' and not is_admin:
            return Response(
                {'error': 'Удалять администраторов может только владелец или администратор'},
                status=status.HTTP_403_FORBIDDEN
            )

        member.delete()

        return Response({'message': 'Участник удален из компании'})

    # ─── Role management ──────────────────────────────────────────────────────

    def _require_role_manager(self, company_id, user):
        """Проверяет, может ли пользователь управлять ролями в компании."""
        membership = CompanyMember.objects.filter(
            company_id=company_id, user=user, status='active'
        ).first()
        if not membership:
            return None, Response({'error': 'Нет доступа к компании'}, status=status.HTTP_403_FORBIDDEN)
        if membership.role not in ('owner', 'admin'):
            # Проверяем кастомное разрешение roles.manage (только неистёкшие роли)
            has_perm = UserRole.objects.filter(
                user=user,
                role__context_type='company',
                role__context_id=company_id,
                role__permissions__permission__code='roles.manage',
                role__permissions__granted=True,
            ).filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
            ).exists()
            if not has_perm:
                return None, Response({'error': 'Нет прав для управления ролями'}, status=status.HTTP_403_FORBIDDEN)
        return membership, None

    @action(detail=True, methods=['get', 'post'], url_path='roles')
    def roles(self, request, pk=None):
        """GET: список ролей компании. POST: создать роль."""
        _, err = self._require_role_manager(pk, request.user)
        if err:
            return err

        if request.method == 'GET':
            qs = Role.objects.filter(
                context_type='company', context_id=pk
            ).prefetch_related('permissions__permission')
            return Response(RoleSerializer(qs, many=True).data)

        # POST — создать роль
        serializer = RoleCreateSerializer(
            data=request.data,
            context={'company_id': pk}
        )
        serializer.is_valid(raise_exception=True)
        role = Role.objects.create(
            name=serializer.validated_data['name'],
            context_type='company',
            context_id=pk,
            created_by=request.user,
        )
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'roles/(?P<role_id>[^/.]+)')
    def role_detail(self, request, pk=None, role_id=None):
        """PATCH: переименовать роль. DELETE: удалить роль."""
        _, err = self._require_role_manager(pk, request.user)
        if err:
            return err

        try:
            role = Role.objects.get(id=role_id, context_type='company', context_id=pk)
        except Role.DoesNotExist:
            return Response({'error': 'Роль не найдена'}, status=status.HTTP_404_NOT_FOUND)

        if role.is_system:
            return Response({'error': 'Системную роль нельзя изменить'}, status=status.HTTP_400_BAD_REQUEST)

        if request.method == 'DELETE':
            role.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        # PATCH
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Название обязательно'}, status=status.HTTP_400_BAD_REQUEST)
        role.name = name
        role.save(update_fields=['name', 'updated_at'])
        return Response(RoleSerializer(role).data)

    @action(detail=True, methods=['post'], url_path=r'roles/(?P<role_id>[^/.]+)/set_permissions')
    def role_set_permissions(self, request, pk=None, role_id=None):
        """Установить набор разрешений для роли (передаётся список кодов)."""
        _, err = self._require_role_manager(pk, request.user)
        if err:
            return err

        try:
            role = Role.objects.get(id=role_id, context_type='company', context_id=pk)
        except Role.DoesNotExist:
            return Response({'error': 'Роль не найдена'}, status=status.HTTP_404_NOT_FOUND)

        codes = request.data.get('permissions', [])
        if not isinstance(codes, list):
            return Response({'error': 'permissions должен быть списком кодов'}, status=status.HTTP_400_BAD_REQUEST)

        valid_perms = Permission.objects.filter(code__in=codes)
        valid_codes = set(valid_perms.values_list('code', flat=True))
        invalid = set(codes) - valid_codes
        if invalid:
            return Response({'error': f'Неизвестные коды: {", ".join(invalid)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Пересоздаём RolePermission
        RolePermission.objects.filter(role=role).delete()
        RolePermission.objects.bulk_create([
            RolePermission(role=role, permission=p, granted=True)
            for p in valid_perms
        ])

        return Response(RoleSerializer(role).data)

    @action(detail=True, methods=['post', 'delete'], url_path=r'members/(?P<user_id>[^/.]+)/roles/(?P<role_id>[^/.]+)')
    def member_role(self, request, pk=None, user_id=None, role_id=None):
        """POST: назначить роль участнику. DELETE: снять роль."""
        _, err = self._require_role_manager(pk, request.user)
        if err:
            return err

        try:
            member = CompanyMember.objects.get(company_id=pk, user_id=user_id, status='active')
        except CompanyMember.DoesNotExist:
            return Response({'error': 'Участник не найден'}, status=status.HTTP_404_NOT_FOUND)

        try:
            role = Role.objects.get(id=role_id, context_type='company', context_id=pk)
        except Role.DoesNotExist:
            return Response({'error': 'Роль не найдена'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'POST':
            ur, created = UserRole.objects.get_or_create(
                user=member.user, role=role,
                defaults={'granted_by': request.user}
            )
            return Response(UserRoleSerializer(ur).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        # DELETE
        UserRole.objects.filter(user=member.user, role=role).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path=r'members/(?P<user_id>[^/.]+)/roles')
    def member_roles(self, request, pk=None, user_id=None):
        """Роли конкретного участника в компании."""
        if not CompanyMember.objects.filter(company_id=pk, user=request.user, status='active').exists():
            return Response({'error': 'Нет доступа'}, status=status.HTTP_403_FORBIDDEN)

        urs = UserRole.objects.filter(
            user_id=user_id,
            role__context_type='company',
            role__context_id=pk,
        ).select_related('role', 'user', 'granted_by')
        return Response(UserRoleSerializer(urs, many=True).data)