from __future__ import annotations

from django.urls import path

from apps.labels.views import LabelDetailView, LabelListCreateView

urlpatterns = [
    path(
        "projects/<uuid:project_id>/labels/",
        LabelListCreateView.as_view(),
        name="label-list-create",
    ),
    path(
        "projects/<uuid:project_id>/labels/<uuid:label_id>/",
        LabelDetailView.as_view(),
        name="label-detail",
    ),
]
