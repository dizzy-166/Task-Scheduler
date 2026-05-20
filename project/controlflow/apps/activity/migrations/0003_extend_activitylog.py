from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activity', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='activitylog',
            name='ip_address',
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='activitylog',
            name='entity_type',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='activitylog',
            name='entity_id',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='activitylog',
            name='details',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['action', 'created_at'], name='activity_action_created_idx'),
        ),
        migrations.AddIndex(
            model_name='activitylog',
            index=models.Index(fields=['entity_type', 'entity_id'], name='activity_entity_idx'),
        ),
    ]
