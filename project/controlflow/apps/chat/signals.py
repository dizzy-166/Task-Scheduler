import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(pre_save, sender='tasks.Task')
def task_pre_save(sender, instance, **kwargs):
    """Сохраняем старые значения для сравнения в post_save."""
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            instance._old_assignee_id = old.assignee_id
            instance._old_status      = old.status
        except sender.DoesNotExist:
            instance._old_assignee_id = None
            instance._old_status      = None
    else:
        instance._old_assignee_id = None
        instance._old_status      = None


@receiver(post_save, sender='tasks.Task')
def task_post_save(sender, instance, created, **kwargs):
    from apps.chat.models import Notification

    if not instance.company_id:
        return

    STATUS_LABELS = {
        'new': 'Новая', 'in_progress': 'В работе',
        'review': 'На проверке', 'done': 'Завершена', 'cancelled': 'Отменена',
    }

    if created:
        # Уведомление исполнителю о новой задаче
        if instance.assignee and instance.assignee != instance.creator:
            Notification.objects.create(
                recipient=instance.assignee,
                company_id=instance.company_id,
                type='task_assigned',
                title='Вам назначена задача',
                body=instance.title,
                related_task=instance,
            )
    else:
        old_assignee_id = getattr(instance, '_old_assignee_id', None)
        old_status      = getattr(instance, '_old_status', None)

        # Смена исполнителя
        if (instance.assignee_id and
                instance.assignee_id != old_assignee_id and
                instance.assignee != instance.creator):
            Notification.objects.create(
                recipient=instance.assignee,
                company_id=instance.company_id,
                type='task_assigned',
                title='Вам назначена задача',
                body=instance.title,
                related_task=instance,
            )

        # Смена статуса — уведомляем всех активных участников компании
        if old_status and instance.status != old_status and instance.company_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            label = STATUS_LABELS.get(instance.status, instance.status)
            members = list(User.objects.filter(
                company_memberships__company_id=instance.company_id,
                company_memberships__status='active',
            ).distinct())
            logger.info(
                'status_changed signal: task=%s company=%s old=%s new=%s members=%s',
                instance.pk, instance.company_id, old_status, instance.status,
                [m.pk for m in members],
            )
            notifications = [
                Notification(
                    recipient=member,
                    company_id=instance.company_id,
                    type='status_changed',
                    title=f'Статус изменён: {label}',
                    body=instance.title,
                    related_task=instance,
                )
                for member in members
            ]
            created = Notification.objects.bulk_create(notifications)
            logger.info('status_changed signal: created %d notifications', len(created))
