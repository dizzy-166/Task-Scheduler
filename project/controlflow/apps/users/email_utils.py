import json
import urllib.request
from django.conf import settings


def _brevo_send(to_email, subject, body):
    payload = {
        'sender': {'email': settings.DEFAULT_FROM_EMAIL, 'name': 'Поток'},
        'to': [{'email': to_email}],
        'subject': subject,
        'textContent': body,
    }
    req = urllib.request.Request(
        'https://api.brevo.com/v3/smtp/email',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'api-key': settings.BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.status not in (200, 201):
            raise Exception(f'Brevo error: {resp.status}')


def send_verification_email(user, code):
    _brevo_send(
        to_email=user.email,
        subject='Код подтверждения — Поток',
        body=(
            f'Здравствуйте, {user.first_name}!\n\n'
            f'Ваш код подтверждения:\n\n'
            f'    {code}\n\n'
            f'Введите его на сайте. Код действителен 24 часа.\n\n'
            f'Если вы не регистрировались в Поток, проигнорируйте это письмо.'
        ),
    )


def send_password_reset_email(user, token):
    reset_url = f'{settings.FRONTEND_URL}/reset-password?token={token}'
    _brevo_send(
        to_email=user.email,
        subject='Сброс пароля — Поток',
        body=(
            f'Здравствуйте, {user.first_name}!\n\n'
            f'Для сброса пароля перейдите по ссылке:\n{reset_url}\n\n'
            f'Ссылка действительна 1 час.\n\n'
            f'Если вы не запрашивали сброс пароля, проигнорируйте это письмо.'
        ),
    )
