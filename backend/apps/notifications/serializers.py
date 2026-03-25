from __future__ import annotations

from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "title",
            "message",
            "data",
            "is_read",
            "read_at",
            "created_at",
        )
        read_only_fields = fields


class NotificationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["accept", "reject"])
