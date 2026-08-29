from __future__ import annotations

from django.urls import path

from apps.goals.views import WeeklyBoardView, WeeklyGoalItemListView, WeeklyGoalItemView

urlpatterns = [
    path(
        "workspaces/<slug:workspace_slug>/weekly-board/",
        WeeklyBoardView.as_view(),
        name="weekly-board",
    ),
    path(
        "workspaces/<slug:workspace_slug>/weekly-board/items/",
        WeeklyGoalItemListView.as_view(),
        name="weekly-board-item-create",
    ),
    path(
        "workspaces/<slug:workspace_slug>/weekly-board/items/<uuid:item_id>/",
        WeeklyGoalItemView.as_view(),
        name="weekly-board-item-detail",
    ),
]
