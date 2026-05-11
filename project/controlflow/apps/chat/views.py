from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import ChatMessage, Notification
from .serializers import ChatMessageSerializer, NotificationSerializer


class ChatMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id   = request.headers.get('X-Company-Id')
        channel_type = request.query_params.get('type', 'company')
        project_id   = request.query_params.get('project_id')
        with_user    = request.query_params.get('with_user')

        if not company_id:
            return Response([])

        if channel_type == 'direct' and with_user:
            me = request.user.id
            qs = ChatMessage.objects.filter(
                company_id=company_id,
                channel_type='direct',
            ).filter(
                Q(sender_id=me, recipient_id=with_user) |
                Q(sender_id=with_user, recipient_id=me)
            )
        elif channel_type == 'project' and project_id:
            qs = ChatMessage.objects.filter(
                company_id=company_id,
                channel_type='project',
                project_id=project_id,
            )
        else:
            qs = ChatMessage.objects.filter(
                company_id=company_id,
                channel_type='company',
            )

        qs = qs.select_related('sender', 'reply_to', 'reply_to__sender')
        messages = list(qs.order_by('-created_at')[:100])[::-1]
        return Response(ChatMessageSerializer(messages, many=True).data)

    def post(self, request):
        company_id   = request.headers.get('X-Company-Id')
        if not company_id:
            return Response({'error': 'X-Company-Id required'}, status=400)

        text         = request.data.get('text', '').strip()
        channel_type = request.data.get('channel_type', 'company')
        project_id   = request.data.get('project_id')
        recipient_id = request.data.get('recipient_id')
        reply_to_id  = request.data.get('reply_to_id')

        if not text:
            return Response({'error': 'text required'}, status=400)

        msg = ChatMessage.objects.create(
            company_id=company_id,
            channel_type=channel_type,
            project_id=project_id or None,
            recipient_id=recipient_id or None,
            sender=request.user,
            text=text,
            reply_to_id=reply_to_id or None,
        )

        # Parse @mentions and notify mentioned users (not in direct messages)
        if '@' in text and channel_type != 'direct':
            from apps.companies.models import CompanyMember
            members = CompanyMember.objects.filter(
                company_id=company_id, status='active'
            ).select_related('user').exclude(user=request.user)
            author_name = request.user.full_name or request.user.email
            for m in members:
                full = m.user.full_name or m.user.email
                if full and f'@{full}' in text:
                    Notification.objects.create(
                        recipient=m.user,
                        company_id=company_id,
                        type='chat_mention',
                        title=f'{author_name} упомянул вас в чате',
                        body=text[:200],
                    )

        msg.refresh_from_db()
        return Response(ChatMessageSerializer(
            ChatMessage.objects.select_related('sender', 'reply_to', 'reply_to__sender').get(pk=msg.pk)
        ).data, status=201)


class ChatMessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            msg = ChatMessage.objects.get(pk=pk)
        except ChatMessage.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        if msg.sender != request.user:
            return Response({'error': 'Forbidden'}, status=403)
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'error': 'text required'}, status=400)
        msg.text = text
        msg.edited_at = timezone.now()
        msg.save()
        return Response(ChatMessageSerializer(
            ChatMessage.objects.select_related('sender', 'reply_to', 'reply_to__sender').get(pk=msg.pk)
        ).data)

    def delete(self, request, pk):
        try:
            msg = ChatMessage.objects.get(pk=pk)
        except ChatMessage.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        if msg.sender != request.user:
            return Response({'error': 'Forbidden'}, status=403)
        msg.delete()
        return Response(status=204)


class ChatMembersView(APIView):
    """Список участников компании для ЛС-панели."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.companies.models import CompanyMember
        company_id = request.headers.get('X-Company-Id')
        if not company_id:
            return Response([])

        members = CompanyMember.objects.filter(
            company_id=company_id, status='active'
        ).select_related('user').exclude(user=request.user)

        result = [{
            'id':       m.user.id,
            'name':     m.user.full_name or m.user.email,
            'initials': (
                (m.user.first_name[:1] + m.user.last_name[:1]).upper()
                if m.user.first_name else m.user.email[:1].upper()
            ),
            'email':    m.user.email,
        } for m in members]
        return Response(result)


class NotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.headers.get('X-Company-Id')
        qs = Notification.objects.filter(recipient=request.user)
        if company_id:
            qs = qs.filter(company_id=company_id)
        notifications = qs[:50]
        unread = qs.filter(is_read=False).count()
        return Response({
            'results': NotificationSerializer(notifications, many=True).data,
            'unread':  unread,
        })


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        company_id = request.headers.get('X-Company-Id')
        if pk:
            Notification.objects.filter(pk=pk, recipient=request.user).update(is_read=True)
        else:
            qs = Notification.objects.filter(recipient=request.user)
            if company_id:
                qs = qs.filter(company_id=company_id)
            qs.update(is_read=True)
        return Response({'ok': True})
