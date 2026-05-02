from django.db import migrations

PERMISSIONS = [
    {'code': 'tasks.create',    'resource': 'tasks',    'action': 'create',    'description': 'Создавать задачи'},
    {'code': 'tasks.edit_any',  'resource': 'tasks',    'action': 'edit_any',  'description': 'Редактировать любые задачи'},
    {'code': 'tasks.delete_any','resource': 'tasks',    'action': 'delete_any','description': 'Удалять задачи'},
    {'code': 'tasks.assign',    'resource': 'tasks',    'action': 'assign',    'description': 'Назначать исполнителей'},
    {'code': 'tasks.view_all',  'resource': 'tasks',    'action': 'view_all',  'description': 'Просматривать все задачи'},
    {'code': 'projects.create', 'resource': 'projects', 'action': 'create',    'description': 'Создавать проекты'},
    {'code': 'projects.edit',   'resource': 'projects', 'action': 'edit',      'description': 'Редактировать проекты'},
    {'code': 'projects.delete', 'resource': 'projects', 'action': 'delete',    'description': 'Удалять проекты'},
    {'code': 'members.invite',  'resource': 'members',  'action': 'invite',    'description': 'Приглашать участников'},
    {'code': 'members.remove',  'resource': 'members',  'action': 'remove',    'description': 'Удалять участников'},
    {'code': 'roles.manage',    'resource': 'roles',    'action': 'manage',    'description': 'Управлять ролями'},
]


def seed_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    for data in PERMISSIONS:
        Permission.objects.get_or_create(code=data['code'], defaults=data)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_permission_role_rolepermission_userrole_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_permissions, noop),
    ]
