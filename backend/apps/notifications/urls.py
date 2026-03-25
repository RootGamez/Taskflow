from django.urls import path

from apps.notifications.views import (
    NotificationActionView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/mark-all-read/", NotificationMarkAllReadView.as_view(), name="notification-mark-all-read"),
    path("notifications/<uuid:notification_id>/mark-read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
    path("notifications/<uuid:notification_id>/action/", NotificationActionView.as_view(), name="notification-action"),
]
