import resend
from django.conf import settings


def _get_client():
    resend.api_key = settings.RESEND_API_KEY
    return resend.Emails


def send_verification_email(user, code):
    _get_client().send({
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [user.email],
        "subject": "Код подтверждения — Поток",
        "text": (
            f"Здравствуйте, {user.first_name}!\n\n"
            f"Ваш код подтверждения:\n\n"
            f"    {code}\n\n"
            f"Введите его на сайте. Код действителен 24 часа.\n\n"
            f"Если вы не регистрировались в Поток, проигнорируйте это письмо."
        ),
    })


def send_password_reset_email(user, token):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    _get_client().send({
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [user.email],
        "subject": "Сброс пароля — Поток",
        "text": (
            f"Здравствуйте, {user.first_name}!\n\n"
            f"Для сброса пароля перейдите по ссылке:\n{reset_url}\n\n"
            f"Ссылка действительна 1 час.\n\n"
            f"Если вы не запрашивали сброс пароля, проигнорируйте это письмо."
        ),
    })
