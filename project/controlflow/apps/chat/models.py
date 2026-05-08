from django.db import models
from django.conf import settings


class ChatMessage(models.Model):
    CHANNEL_COMPANY = 'company'
    CHANNEL_PROJECT = 'project'
    CHANNEL_DIRECT  = 'direct'
    CHANNEL_CHOICES = [
        (CHANNEL_COMPANY, 'Общий'),
        (CHANNEL_PROJECT, 'Проект'),
        (CHANNEL_DIRECT,  'Личное'),
    ]

    company      = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name='chat_messages')
    channel_type = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default=CHANNEL_COMPANY)
    project      = models.ForeignKey('core.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='chat_messages')
    # For DMs: recipient is the other participant (sender is always the author)
    recipient    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_messages')
    sender       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    text         = models.TextField()
    reply_to     = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    created_at   = models.DateTimeField(auto_now_add=True)
    edited_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender} [{self.channel_type}]: {self.text[:40]}'


class Notification(models.Model):
    TYPE_CHOICES = [
        ('task_assigned',    'Назначена задача'),
        ('status_changed',   'Изменён статус'),
        ('deadline_soon',    'Скоро дедлайн'),
        ('task_created',     'Создана задача'),
        ('comment_mention',  'Упоминание в комментарии'),
    ]

    recipient    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    company      = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name='notifications')
    type         = models.CharField(max_length=30, choices=TYPE_CHOICES)
    title        = models.CharField(max_length=200)
    body         = models.CharField(max_length=500, blank=True)
    is_read      = models.BooleanField(default=False)
    related_task = models.ForeignKey('tasks.Task', on_delete=models.SET_NULL, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.recipient} - {self.title}'
