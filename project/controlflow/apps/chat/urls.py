from django.urls import path
from .views import ChatMessagesView, ChatMessageDetailView, ChatMembersView, NotificationsView, NotificationReadView

urlpatterns = [
    path('chat/messages/',               ChatMessagesView.as_view(),      name='chat-messages'),
    path('chat/messages/<int:pk>/',      ChatMessageDetailView.as_view(), name='chat-message-detail'),
    path('chat/members/',                ChatMembersView.as_view(),       name='chat-members'),
    path('notifications/',               NotificationsView.as_view(),     name='notifications'),
    path('notifications/read/',          NotificationReadView.as_view(),  name='notifications-read-all'),
    path('notifications/<int:pk>/read/', NotificationReadView.as_view(),  name='notifications-read-one'),
]
