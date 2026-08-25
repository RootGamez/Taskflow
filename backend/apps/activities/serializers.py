from __future__ import annotations

from rest_framework import serializers

from apps.activities.models import Activity


class ActivitySerializer(serializers.ModelSerializer):
    """Representación de solo lectura de una `Activity` para la API y el
    evento realtime (`activity.created`). El actor se serializa inline
    (denormalizado a partir de la FK, sin exponer más que lo necesario para
    el timeline) para no acoplar el frontend al `UserSerializer` completo.
    """

    ticket_id = serializers.UUIDField(read_only=True)
    actor = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = (
            "id",
            "ticket_id",
            "actor",
            "action",
            "from_value",
            "to_value",
            "created_at",
        )
        read_only_fields = fields

    def get_actor(self, obj: Activity) -> dict | None:
        if obj.actor_id is None:
            return None
        return {"id": str(obj.actor_id), "full_name": obj.actor.full_name}
