"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # API v1
    path('api/v1/', include('apps.users.urls')),
    path('api/v1/', include('apps.tasks.urls')),
    path('api/v1/', include('apps.companies.urls')),

    # API (без v1) - для обратной совместимости
    path('api/', include('apps.tasks.urls')),

    # API документация
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]