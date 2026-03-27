from django.urls import path

from apps.users.views import (
	MeView,
	ChangePasswordView,
	UserSessionListView,
	UserSessionDetailView,
	UserSessionRevokeOthersView,
	UserPreferencesView,
	UserDeactivateView,
	UserAvatarUploadView,
)

urlpatterns = [
	path("me/", MeView.as_view(), name="me"),
	path("me/avatar/", UserAvatarUploadView.as_view(), name="user_avatar_upload"),
	path("me/change-password/", ChangePasswordView.as_view(), name="change_password"),
	path("me/sessions/", UserSessionListView.as_view(), name="user_sessions"),
	path("me/sessions/<uuid:session_id>/", UserSessionDetailView.as_view(), name="user_session_detail"),
	path("me/sessions/revoke-others/", UserSessionRevokeOthersView.as_view(), name="revoke_other_sessions"),
	path("me/preferences/", UserPreferencesView.as_view(), name="user_preferences"),
	path("me/deactivate/", UserDeactivateView.as_view(), name="deactivate_account"),
]
