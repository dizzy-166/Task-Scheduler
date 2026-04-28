from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyViewSet, PermissionListView

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='companies')

urlpatterns = [
    path('', include(router.urls)),
    path('permissions/', PermissionListView.as_view(), name='permissions-list'),
]