from __future__ import annotations

from django.urls import path

from apps.subtasks.views import SubTaskDetailView, SubTaskListCreateView

urlpatterns = [
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/subtasks/",
        SubTaskListCreateView.as_view(),
        name="subtask-list-create",
    ),
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/subtasks/<uuid:subtask_id>/",
        SubTaskDetailView.as_view(),
        name="subtask-detail",
    ),
]
