from django.core.mail import send_mail
from django.conf import settings


def send_verification_email(user, code):
    send_mail(
        subject='Код подтверждения — Поток',
        message=(
            f'Здравствуйте, {user.first_name}!\n\n'
            f'Ваш код подтверждения:\n\n'
            f'    {code}\n\n'
            f'Введите его на сайте. Код действителен 24 часа.\n\n'
            f'Если вы не регистрировались в Поток, проигнорируйте это письмо.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def send_password_reset_email(user, token):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    send_mail(
        subject='Сброс пароля — Поток',
        message=(
            f'Здравствуйте, {user.first_name}!\n\n'
            f'Для сброса пароля перейдите по ссылке:\n{reset_url}\n\n'
            f'Ссылка действительна 1 час.\n\n'
            f'Если вы не запрашивали сброс пароля, проигнорируйте это письмо.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
