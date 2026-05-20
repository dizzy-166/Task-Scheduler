import logging
import secrets

from rest_framework import status, viewsets, generics
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db import models as django_models, transaction
from django.db.models import Q

logger = logging.getLogger(__name__)

from apps.activity.utils import log_activity
from .models import User, EmailVerificationToken, PasswordResetToken
from .serializers import (
    UserSerializer, RegisterSerializer, ChangePasswordSerializer
)
from .permissions import CanManageUsers
from .email_utils import send_verification_email, send_password_reset_email


class CustomTokenObtainPairView(TokenObtainPairView):
    """Кастомный view для получения JWT токенов"""

    def post(self, request, *args, **kwargs):
        email = request.data.get('email', '')
        user = User.objects.filter(email=email).first()
        if user and not user.is_verified:
            return Response(
                {'detail': 'Подтвердите email перед входом. Проверьте почту или запросите новое письмо подтверждения.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        response = super().post(request, *args, **kwargs)

        if response.status_code == status.HTTP_200_OK:
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

        code = str(secrets.randbelow(900000) + 100000)
        EmailVerificationToken.objects.create(user=user, token=code)
        try:
            send_verification_email(user, code)
        except BaseException as e:
            logger.error(f'Failed to send verification email to {user.email}: {e}')

        return Response(
            {'detail': f'Код подтверждения отправлен на {user.email}.'},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(generics.GenericAPIView):
    """Подтверждение email по коду из письма"""

    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        code = request.data.get('code', '').strip()

        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Неверный код.'}, status=status.HTTP_400_BAD_REQUEST)

        vt = EmailVerificationToken.objects.filter(
            user=user, is_used=False
        ).order_by('-created_at').first()

        if not vt or vt.token != code:
            return Response({'detail': 'Неверный код.'}, status=status.HTTP_400_BAD_REQUEST)

        if vt.is_expired:
            return Response({'detail': 'Код устарел. Запросите новый.'}, status=status.HTTP_400_BAD_REQUEST)

        vt.is_used = True
        vt.save(update_fields=['is_used'])
        user.is_verified = True
        user.save(update_fields=['is_verified'])

        return Response({'detail': 'Email успешно подтверждён. Теперь вы можете войти.'})


class ResendVerificationView(generics.GenericAPIView):
    """Повторная отправка кода подтверждения"""

    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        user = User.objects.filter(email=email, is_active=True, is_verified=False).first()
        if user:
            code = str(secrets.randbelow(900000) + 100000)
            EmailVerificationToken.objects.create(user=user, token=code)
            try:
                send_verification_email(user, code)
            except BaseException as e:
                logger.error(f'Failed to resend verification email to {user.email}: {e}')
        return Response({'detail': 'Если такой email зарегистрирован и не подтверждён, код отправлен.'})


class ForgotPasswordView(generics.GenericAPIView):
    """Запрос сброса пароля"""

    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            token_obj = PasswordResetToken.objects.create(user=user)
            try:
                send_password_reset_email(user, token_obj.token)
            except Exception:
                pass
        return Response({'detail': 'Если такой email зарегистрирован, письмо с инструкцией отправлено.'})


class ResetPasswordView(generics.GenericAPIView):
    """Установка нового пароля по токену из письма"""

    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token', '')
        password = request.data.get('password', '')

        if len(password) < 8:
            return Response({'detail': 'Пароль должен содержать не менее 8 символов.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            rt = PasswordResetToken.objects.select_related('user').get(token=token, is_used=False)
        except PasswordResetToken.DoesNotExist:
            return Response({'detail': 'Недействительная ссылка сброса пароля.'}, status=status.HTTP_400_BAD_REQUEST)

        if rt.is_expired:
            return Response({'detail': 'Ссылка устарела. Запросите сброс пароля заново.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            rt.user.set_password(password)
            rt.user.save()
            rt.is_used = True
            rt.save(update_fields=['is_used'])

        return Response({'detail': 'Пароль успешно изменён. Войдите с новым паролем.'})


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с пользователями"""
    
    queryset = User.objects.filter(deleted_at__isnull=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, CanManageUsers]
    
    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.is_superuser:
            return queryset

        from apps.companies.models import CompanyMember
        company_ids = list(CompanyMember.objects.filter(
            user=user, status='active'
        ).values_list('company_id', flat=True))

        if company_ids:
            member_ids = CompanyMember.objects.filter(
                company_id__in=company_ids, status='active'
            ).values_list('user_id', flat=True)
            return queryset.filter(id__in=member_ids)

        return queryset.filter(id=user.id)
    
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Информация о текущем пользователе"""
        if request.method == 'PATCH':
            serializer = self.get_serializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
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

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def search(self, request):
        """Поиск пользователей по email/имени для автокомплита приглашения"""
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])
        users = User.objects.filter(
            deleted_at__isnull=True, is_active=True
        ).filter(
            Q(email__icontains=q) |
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q)
        ).only('id', 'email', 'first_name', 'last_name')[:10]
        return Response([
            {
                'id': str(u.id),
                'email': u.email,
                'full_name': f'{u.first_name} {u.last_name}'.strip() or u.email,
            }
            for u in users
        ])