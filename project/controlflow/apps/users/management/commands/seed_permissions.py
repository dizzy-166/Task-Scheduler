from django.core.management.base import BaseCommand
from apps.users.models import Permission

PERMISSIONS = [
    {'code': 'tasks.create',    'resource': 'tasks',    'action': 'create',    'description': 'Создавать задачи'},
    {'code': 'tasks.edit_any',  'resource': 'tasks',    'action': 'edit_any',  'description': 'Редактировать любые задачи'},
    {'code': 'tasks.delete_any','resource': 'tasks',    'action': 'delete_any','description': 'Удалять задачи'},
    {'code': 'tasks.assign',    'resource': 'tasks',    'action': 'assign',    'description': 'Назначать исполнителей'},
    {'code': 'tasks.view_all',  'resource': 'tasks',    'action': 'view_all',  'description': 'Просматривать все задачи'},
    {'code': 'tasks.review_approve', 'resource': 'tasks', 'action': 'review_approve', 'description': 'Подтверждать задачи (перевод в «Готово»)'},
    {'code': 'projects.create', 'resource': 'projects', 'action': 'create',    'description': 'Создавать проекты'},
    {'code': 'projects.edit',   'resource': 'projects', 'action': 'edit',      'description': 'Редактировать проекты'},
    {'code': 'projects.delete', 'resource': 'projects', 'action': 'delete',    'description': 'Удалять проекты'},
    {'code': 'members.invite',  'resource': 'members',  'action': 'invite',    'description': 'Приглашать участников'},
    {'code': 'members.remove',  'resource': 'members',  'action': 'remove',    'description': 'Удалять участников'},
    {'code': 'roles.manage',    'resource': 'roles',    'action': 'manage',    'description': 'Управлять ролями'},
    {'code': 'analytics.view',  'resource': 'analytics','action': 'view',      'description': 'Просматривать аналитику и отчёты'},
]


class Command(BaseCommand):
    help = 'Seed default permissions into the database'

    def handle(self, *args, **options):
        created = 0
        for data in PERMISSIONS:
            _, was_created = Permission.objects.get_or_create(code=data['code'], defaults=data)
            if was_created:
                created += 1
        skipped = len(PERMISSIONS) - created
        self.stdout.write(self.style.SUCCESS(
            f'Done: {created} created, {skipped} already existed.'
        ))
