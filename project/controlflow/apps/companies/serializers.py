from rest_framework import serializers
from django.utils import timezone
from .models import Company, CompanyMember
from apps.users.serializers import UserSerializer


class CompanySerializer(serializers.ModelSerializer):
    """Базовый сериализатор компании"""
    
    owner_name = serializers.SerializerMethodField()
    members_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Company
        fields = [
            'id', 'name', 'description', 'owner', 'owner_name',
            'members_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']
    
    def get_owner_name(self, obj):
        return obj.owner.full_name if obj.owner else ''


class CompanyDetailSerializer(serializers.ModelSerializer):
    """Детальный сериализатор компании"""
    
    owner_detail = UserSerializer(source='owner', read_only=True)
    owner_name = serializers.SerializerMethodField()
    members_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Company
        fields = [
            'id', 'name', 'description', 'owner', 'owner_name',
            'owner_detail', 'members_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'owner', 'created_at', 'updated_at']
    
    def get_owner_name(self, obj):
        return obj.owner.full_name if obj.owner else ''


class CompanyCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания компании"""
    
    class Meta:
        model = Company
        fields = ['name', 'description']
    
    def create(self, validated_data):
        user = self.context['request'].user
        company = Company.objects.create(owner=user, **validated_data)
        
        CompanyMember.objects.create(
            company=company,
            user=user,
            role='owner',
            status='active',
            joined_at=timezone.now()
        )
        
        return company


class CompanyMemberSerializer(serializers.ModelSerializer):
    """Сериализатор участника компании"""
    
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    user_detail = UserSerializer(source='user', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    invited_by_name = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CompanyMember
        fields = [
            'id', 'company', 'company_name', 'user', 'user_name', 'user_email',
            'user_detail', 'role', 'role_display', 'status',
            'status_display', 'invited_by', 'invited_by_name',
            'joined_at', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'invited_by', 'joined_at', 'created_at']
    
    def get_user_name(self, obj):
        return obj.user.full_name if obj.user else ''
    
    def get_user_email(self, obj):
        return obj.user.email if obj.user else ''
    
    def get_invited_by_name(self, obj):
        return obj.invited_by.full_name if obj.invited_by else ''
    
    def get_company_name(self, obj):
        return obj.company.name if obj.company else ''


class InviteMemberSerializer(serializers.Serializer):
    """Сериализатор для приглашения участника"""
    
    email = serializers.EmailField(required=True)
    role = serializers.ChoiceField(
        choices=CompanyMember.ROLE_CHOICES,
        default='member'
    )
    
    def validate_email(self, value):
        from apps.users.models import User
        if not User.objects.filter(email=value, deleted_at__isnull=True).exists():
            raise serializers.ValidationError('Пользователь с таким email не найден')
        return value.lower()
    
    def validate(self, data):
        from apps.users.models import User
        user = User.objects.get(email=data['email'], deleted_at__isnull=True)
        company = self.context['company']
        
        existing = CompanyMember.objects.filter(company=company, user=user).first()
        
        if existing and existing.status == 'active':
            raise serializers.ValidationError(
                {'email': 'Пользователь уже является участником компании'}
            )
        elif existing and existing.status == 'invited':
            raise serializers.ValidationError(
                {'email': 'Приглашение уже отправлено'}
            )
        
        return data


class RespondInviteSerializer(serializers.Serializer):
    """Сериализатор для ответа на приглашение"""
    
    action = serializers.ChoiceField(choices=['accept', 'decline'], required=True)