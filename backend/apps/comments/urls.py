from django.urls import path

from apps.comments.views import CommentDetailView, CommentListCreateView

urlpatterns = [
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/comments/",
        CommentListCreateView.as_view(),
        name="comment-list-create",
    ),
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/comments/<uuid:comment_id>/",
        CommentDetailView.as_view(),
        name="comment-detail",
    ),
]
