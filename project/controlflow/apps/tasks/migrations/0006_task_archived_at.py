from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0005_add_task_timer'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='archived_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True, verbose_name='Архивирован'),
        ),
        migrations.AddIndex(
            model_name='task',
            index=models.Index(fields=['archived_at'], name='tasks_archived_at_idx'),
        ),
    ]
