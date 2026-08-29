from __future__ import annotations

from django.urls import path

from apps.pages.views import PageDetailView, PageListCreateView

# Incluido bajo "api/v1/" en config/urls.py (WP-0A). El converter `slug` de
# Django no cruza "/": "workspaces/<slug>/pages/" NO colisiona con ningun
# patron de apps/workspaces/urls.py (R0A-1, verificado con
# test_page_routes_do_not_collide_with_workspace_detail).
urlpatterns = [
    path(
        "workspaces/<slug:workspace_slug>/pages/",
        PageListCreateView.as_view(),
        name="page-list-create",
    ),
    path(
        "workspaces/<slug:workspace_slug>/pages/<uuid:page_id>/",
        PageDetailView.as_view(),
        name="page-detail",
    ),
]
