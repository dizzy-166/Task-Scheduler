import logging

logger = logging.getLogger(__name__)


def log_activity(user=None, action='', **kwargs):
    try:
        from .models import ActivityLog
        ActivityLog.objects.create(
            user=user,
            action=action,
            ip_address=kwargs.get('ip_address'),
            entity_type=kwargs.get('entity_type'),
            entity_id=str(kwargs['entity_id']) if kwargs.get('entity_id') else None,
            details=kwargs.get('details'),
        )
    except Exception as exc:
        logger.error('log_activity failed action=%s: %s', action, exc)
