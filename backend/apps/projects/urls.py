from django.urls import path

from apps.projects.views import (
    ProjectColumnDetailView,
    ProjectColumnListCreateView,
    ProjectDetailView,
    ProjectListCreateView,
)

urlpatterns = [
    path(
        "workspaces/<slug:workspace_slug>/projects/",
        ProjectListCreateView.as_view(),
        name="project-list-create",
    ),
    path(
        "workspaces/<slug:workspace_slug>/projects/<uuid:project_id>/",
        ProjectDetailView.as_view(),
        name="project-detail",
    ),
    path(
        "projects/<uuid:project_id>/columns/",
        ProjectColumnListCreateView.as_view(),
        name="project-column-list-create",
    ),
    path(
        "projects/<uuid:project_id>/columns/<uuid:column_id>/",
        ProjectColumnDetailView.as_view(),
        name="project-column-detail",
    ),
]
