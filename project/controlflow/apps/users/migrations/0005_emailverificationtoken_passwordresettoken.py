import secrets
import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


def _verification_expires():
    from django.utils import timezone
    from datetime import timedelta
    return timezone.now() + timedelta(hours=24)


def _reset_expires():
    from django.utils import timezone
    from datetime import timedelta
    return timezone.now() + timedelta(hours=1)


def verify_existing_users(apps, schema_editor):
    """Mark all existing users as verified so they aren't locked out by the new check."""
    User = apps.get_model('users', 'User')
    User.objects.filter(is_verified=False).update(is_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_seed_default_permissions'),
    ]

    operations = [
        migrations.RunPython(verify_existing_users, migrations.RunPython.noop),
        migrations.CreateModel(
            name='EmailVerificationToken',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('token', models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('expires_at', models.DateTimeField(default=_verification_expires)),
                ('is_used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='verification_tokens',
                    to='users.user',
                )),
            ],
            options={'db_table': 'email_verification_tokens'},
        ),
        migrations.CreateModel(
            name='PasswordResetToken',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('token', models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('expires_at', models.DateTimeField(default=_reset_expires)),
                ('is_used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reset_tokens',
                    to='users.user',
                )),
            ],
            options={'db_table': 'password_reset_tokens'},
        ),
    ]
