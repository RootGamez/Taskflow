from __future__ import annotations

from rest_framework import serializers

from apps.labels.models import Label


class LabelSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Label
        fields = ("id", "project_id", "name", "color", "created_at")
