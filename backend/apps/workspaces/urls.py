from django.urls import path

from apps.workspaces.views import (
    WorkspaceListCreateView,
    WorkspaceMemberDetailView,
    WorkspaceMemberListInviteView,
    WorkspaceSelectActiveView,
)

urlpatterns = [
    path("", WorkspaceListCreateView.as_view(), name="workspace-list-create"),
    path("select-active/", WorkspaceSelectActiveView.as_view(), name="workspace-select-active"),
    path("<slug:workspace_slug>/members/", WorkspaceMemberListInviteView.as_view(), name="workspace-member-list-invite"),
    path("<slug:workspace_slug>/members/<uuid:member_id>/", WorkspaceMemberDetailView.as_view(), name="workspace-member-detail"),
]
