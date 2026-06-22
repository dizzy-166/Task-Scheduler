from django.db import migrations

# Права, добавленные во второй итерации RBAC: подтверждение задач и доступ
# к аналитике/отчётам.
NEW_PERMISSIONS = [
    {'code': 'tasks.review_approve', 'resource': 'tasks',     'action': 'review_approve', 'description': 'Подтверждать задачи (перевод в «Готово»)'},
    {'code': 'analytics.view',       'resource': 'analytics', 'action': 'view',           'description': 'Просматривать аналитику и отчёты'},
]


def seed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for data in NEW_PERMISSIONS:
        Permission.objects.get_or_create(code=data['code'], defaults=data)


def unseed(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(code__in=[p['code'] for p in NEW_PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_fix_token_fk_cascade'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
