import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import connection
from django.utils.timezone import now

migrations = [
    ("activity", "0001_initial"),
    ("activity", "0002_initial"),
    ("admin", "0001_initial"),
    ("admin", "0002_logentry_remove_auto_add"),
    ("admin", "0003_logentry_add_action_flag_choices"),
    ("auth", "0001_initial"),
    ("auth", "0002_alter_permission_name_max_length"),
    ("auth", "0003_alter_user_email_max_length"),
    ("auth", "0004_alter_user_username_opts"),
    ("auth", "0005_alter_user_last_login_null"),
    ("auth", "0006_require_contenttypes_0002"),
    ("auth", "0007_alter_validators_add_error_messages"),
    ("auth", "0008_alter_user_username_max_length"),
    ("auth", "0009_alter_user_last_name_max_length"),
    ("auth", "0010_alter_group_name_max_length"),
    ("auth", "0011_update_proxy_permissions"),
    ("auth", "0012_alter_user_first_name_max_length"),
    ("chat", "0001_initial"),
    ("chat", "0002_chatmessage_channel_type_chatmessage_edited_at_and_more"),
    ("companies", "0001_initial"),
    ("companies", "0002_alter_companymember_role"),
    ("contenttypes", "0001_initial"),
    ("contenttypes", "0002_remove_content_type_name"),
    ("core", "0001_initial"),
    ("core", "0002_project_company_project_projects_company_408096_idx"),
    ("sessions", "0001_initial"),
    ("tasks", "0001_initial"),
    ("tasks", "0002_task_company_task_tasks_company_a05724_idx"),
    ("tasks", "0003_kanban_columns"),
    ("tasks", "0004_add_task_comment"),
    ("tasks", "0005_add_task_timer"),
    ("users", "0001_initial"),
    ("users", "0002_user_is_staff_alter_user_is_superuser"),
    ("users", "0003_permission_role_rolepermission_userrole_and_more"),
]

cursor = connection.cursor()
ts = now().strftime("%Y-%m-%d %H:%M:%S+00")
inserted = 0
for app, name in migrations:
    cursor.execute(
        "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
        [app, name, ts]
    )
    inserted += 1

connection.commit()
cursor.execute("SELECT count(*) FROM django_migrations")
count = cursor.fetchone()[0]
print(f"Inserted {inserted} migration records. Total in table: {count}")
