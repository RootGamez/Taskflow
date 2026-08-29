from __future__ import annotations

from django.urls import path

from apps.sprints.views import (
    SprintActivateView,
    SprintCompleteView,
    SprintDetailView,
    SprintListCreateView,
)

urlpatterns = [
    path(
        "workspaces/<slug:workspace_slug>/sprints/",
        SprintListCreateView.as_view(),
        name="sprint-list-create",
    ),
    path(
        "workspaces/<slug:workspace_slug>/sprints/<uuid:sprint_id>/",
        SprintDetailView.as_view(),
        name="sprint-detail",
    ),
    path(
        "workspaces/<slug:workspace_slug>/sprints/<uuid:sprint_id>/activate/",
        SprintActivateView.as_view(),
        name="sprint-activate",
    ),
    path(
        "workspaces/<slug:workspace_slug>/sprints/<uuid:sprint_id>/complete/",
        SprintCompleteView.as_view(),
        name="sprint-complete",
    ),
]
