from django.urls import path

from apps.workspaces.views import WorkspaceListCreateView, WorkspaceSelectActiveView

urlpatterns = [
    path("", WorkspaceListCreateView.as_view(), name="workspace-list-create"),
    path("select-active/", WorkspaceSelectActiveView.as_view(), name="workspace-select-active"),
]
