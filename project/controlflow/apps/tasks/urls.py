from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, KanbanColumnViewSet, AIAnalysisView, AIGenerateTasksView, AIBulkCreateTasksView

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='tasks')
router.register(r'kanban/columns', KanbanColumnViewSet, basename='kanban-columns')

urlpatterns = [
    # Custom paths must come BEFORE include(router.urls) so they don't get
    # shadowed by the router's tasks/{pk}/ detail pattern.
    path('ai/analyze/',           AIAnalysisView.as_view(),       name='ai-analyze'),
    path('tasks/ai-generate/',    AIGenerateTasksView.as_view(),  name='ai-generate'),
    path('tasks/ai-bulk-create/', AIBulkCreateTasksView.as_view(), name='ai-bulk-create'),
    path('', include(router.urls)),
]