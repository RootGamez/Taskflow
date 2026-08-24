from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from apps.users.views import (
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterRequestCodeView,
    RegisterValidateCodeView,
    RegisterVerifyCodeView,
    RegisterView,
)


def health_check(_request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/health/', health_check, name='health-check'),
    path('api/v1/auth/register/', RegisterView.as_view(), name='auth-register'),
    path('api/v1/auth/register/request-code/', RegisterRequestCodeView.as_view(), name='auth-register-request-code'),
    path('api/v1/auth/register/validate-code/', RegisterValidateCodeView.as_view(), name='auth-register-validate-code'),
    path('api/v1/auth/register/verify-code/', RegisterVerifyCodeView.as_view(), name='auth-register-verify-code'),
    path('api/v1/auth/password-reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request'),
    path('api/v1/auth/password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('api/v1/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/v1/auth/refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('api/v1/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/v1/auth/me/', MeView.as_view(), name='auth-me'),
    path('api/v1/auth/token/', TokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/v1/auth/token/verify/', TokenVerifyView.as_view(), name='token-verify'),
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/workspaces/', include('apps.workspaces.urls')),
    path('api/v1/', include('apps.projects.urls')),
    path('api/v1/', include('apps.tickets.urls')),
    path('api/v1/', include('apps.notifications.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
