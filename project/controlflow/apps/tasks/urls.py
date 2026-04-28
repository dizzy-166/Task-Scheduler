from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, KanbanColumnViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='tasks')
router.register(r'kanban/columns', KanbanColumnViewSet, basename='kanban-columns')

urlpatterns = [
    path('', include(router.urls)),
]