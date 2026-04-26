from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from apps.activity.utils import log_activity
from apps.users.models import User
from .models import Company, CompanyMember
from .serializers import (
    CompanySerializer,
    CompanyDetailSerializer,
    CompanyCreateSerializer,
    CompanyMemberSerializer,
    InviteMemberSerializer,
    RespondInviteSerializer,
)


class CompanyViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с компаниями"""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Получение компаний, где пользователь активный участник"""
        user = self.request.user
        print(f"DEBUG: get_queryset called for user {user.email} (ID: {user.id})")
        
        queryset = Company.objects.filter(
            memberships__user=user,
            memberships__status='active',
            deleted_at__isnull=True
        ).distinct().select_related('owner').prefetch_related('memberships')
        
        print(f"DEBUG: found {len(queryset)} companies for user")
        for company in queryset:
            print(f"DEBUG: company {company.name} (ID: {company.id})")
        
        return queryset
    
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
        """Мягкое удаление компании"""
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
        
        # Проверяем права
        membership = CompanyMember.objects.filter(
            company=company,
            user=request.user,
            status='active',
            role__in=['owner', 'admin']
        ).first()
        
        if not membership:
            return Response(
                {'error': 'У вас нет прав для приглашения участников'},
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
        print(f"DEBUG: list_members called for company {pk}")
        print(f"DEBUG: user {request.user.email} (ID: {request.user.id})")
        
        # Проверяем, что пользователь имеет доступ к компании
        membership = CompanyMember.objects.filter(
            company_id=pk,
            user=request.user,
            status='active'
        ).first()
        
        if not membership:
            print(f"DEBUG: user has no access to company {pk}")
            return Response(
                {'error': 'У вас нет доступа к этой компании'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            company = Company.objects.get(id=pk, deleted_at__isnull=True)
            print(f"DEBUG: company found: {company.name} (ID: {company.id})")
        except Company.DoesNotExist:
            print(f"DEBUG: company {pk} not found")
            return Response({'error': 'Компания не найдена'}, status=status.HTTP_404_NOT_FOUND)
        
        members = CompanyMember.objects.filter(
            company=company,
            status='active'
        ).select_related('user', 'invited_by')
        
        print(f"DEBUG: found {len(members)} active members")
        serializer = CompanyMemberSerializer(members, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='pending')
    def list_pending(self, request, pk=None):
        """Получение списка приглашенных участников"""
        print(f"DEBUG: list_pending called for company {pk}")
        
        # Проверяем права доступа (только owner и admin могут видеть приглашенных)
        membership = CompanyMember.objects.filter(
            company_id=pk,
            user=request.user,
            status='active',
            role__in=['owner', 'admin']
        ).first()
        
        if not membership:
            print(f"DEBUG: user has no admin access to company {pk}")
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
        
        current_membership = CompanyMember.objects.filter(
            company=company,
            user=request.user,
            status='active',
            role__in=['owner', 'admin']
        ).first()
        
        if not current_membership:
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
        
        member.delete()
        
        return Response({'message': 'Участник удален из компании'})