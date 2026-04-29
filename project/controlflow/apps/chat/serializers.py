from rest_framework import serializers
from .models import ChatMessage, Notification


class ReplySerializer(serializers.ModelSerializer):
    sender_name     = serializers.CharField(source='sender.full_name', read_only=True)
    sender_initials = serializers.SerializerMethodField()

    class Meta:
        model  = ChatMessage
        fields = ['id', 'sender_name', 'sender_initials', 'text', 'created_at']

    def get_sender_initials(self, obj):
        return _initials(obj.sender)


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name     = serializers.CharField(source='sender.full_name', read_only=True)
    sender_initials = serializers.SerializerMethodField()
    reply_to_data   = ReplySerializer(source='reply_to', read_only=True)

    class Meta:
        model  = ChatMessage
        fields = [
            'id', 'company', 'channel_type', 'project', 'recipient',
            'sender', 'sender_name', 'sender_initials',
            'text', 'reply_to', 'reply_to_data', 'created_at', 'edited_at',
        ]
        read_only_fields = ['id', 'sender', 'sender_name', 'sender_initials',
                            'reply_to_data', 'created_at', 'edited_at']

    def get_sender_initials(self, obj):
        return _initials(obj.sender)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Notification
        fields = ['id', 'type', 'title', 'body', 'is_read', 'related_task', 'created_at']
        read_only_fields = ['id', 'type', 'title', 'body', 'related_task', 'created_at']


def _initials(user):
    fn = user.first_name or ''
    ln = user.last_name  or ''
    return (fn[:1] + ln[:1]).upper() or user.email[:1].upper()
