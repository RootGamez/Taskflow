from __future__ import annotations

from django.urls import path

from apps.linkpreview.views import LinkPreviewView

urlpatterns = [
    path("link-preview/", LinkPreviewView.as_view(), name="link-preview"),
]
