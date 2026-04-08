from rest_framework import status, viewsets, generics
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db import models as django_models

from apps.activity.utils import log_activity
from .models import User
from .serializers import (
    UserSerializer, RegisterSerializer, ChangePasswordSerializer
)
from .permissions import CanManageUsers


class CustomTokenObtainPairView(TokenObtainPairView):
    """Кастомный view для получения JWT токенов"""
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == status.HTTP_200_OK:
            email = request.data.get('email')
            user = User.objects.filter(email=email).first()
            
            if user:
                user.last_login = timezone.now()
                user.save(update_fields=['last_login'])
                
                log_activity(
                    user=user,
                    action='login',
                    ip_address=request.META.get('REMOTE_ADDR'),
                    details={'user_agent': request.META.get('HTTP_USER_AGENT')}
                )
        
        return response


class LogoutView(generics.GenericAPIView):
    """Выход из системы"""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            log_activity(
                user=request.user,
                action='logout',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return Response({'message': 'Успешный выход из системы'})
        except Exception:
            return Response({'message': 'Успешный выход из системы'})


class RegisterView(generics.CreateAPIView):
    """Регистрация нового пользователя"""
    
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        log_activity(
            user=user,
            action='register',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED
        )


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с пользователями"""
    
    queryset = User.objects.filter(deleted_at__isnull=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, CanManageUsers]
    
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        if user.is_admin:
            return queryset
        elif user.is_manager:
            subordinates_ids = [u.id for u in user.get_subordinates_tree()]
            subordinates_ids.append(user.id)
            return queryset.filter(id__in=subordinates_ids)
        else:
            return queryset.filter(
                django_models.Q(id=user.id) | django_models.Q(id=user.manager_id)
            )
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Информация о текущем пользователе"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Смена пароля"""
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        log_activity(
            user=request.user,
            action='change_password',
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({'message': 'Пароль успешно изменён'})
    
    @action(detail=False, methods=['get'])
    def subordinates(self, request):
        """Получение списка подчинённых"""
        queryset = User.objects.filter(manager=request.user, deleted_at__isnull=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)