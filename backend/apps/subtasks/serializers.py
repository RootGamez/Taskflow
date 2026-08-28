from __future__ import annotations

from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers

from apps.subtasks.models import SubTask
from apps.users.serializers import UserSerializer
from apps.workspaces.models import WorkspaceMember


class SubTaskSerializer(serializers.ModelSerializer):
    ticket_id = serializers.UUIDField(read_only=True)
    assignee = UserSerializer(read_only=True)

    class Meta:
        model = SubTask
        fields = (
            "id",
            "ticket_id",
            "title",
            "is_done",
            "order",
            "assignee",
            "completed_at",
            "created_at",
            "updated_at",
        )


# --- A partir de aca: serializers de escritura. `order` e `is_done` no son
# campos declarados a proposito (D30 de docs/PHASE_3_PLAN.md): un cliente
# que los mande en el body los ve simplemente ignorados, nunca aplicados. ---


class _SubTaskWriteSerializerBase(serializers.Serializer):
    """Validaciones compartidas por create/update (D32)."""

    def validate_assignee_id(self, value):
        if value is None:
            return value
        project = self.context["project"]
        # D32: validacion de seguridad, no solo de UX -- sin esto se podria
        # asignar una subtarea a cualquier UUID de usuario del sistema y
        # filtrar su nombre/email en el GET (RB4).
        is_member = WorkspaceMember.objects.filter(
            user_id=value, workspace=project.workspace
        ).exists()
        if not is_member:
            raise serializers.ValidationError("El responsable no pertenece a este espacio.")
        return value


class SubTaskCreateSerializer(_SubTaskWriteSerializerBase):
    title = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "El titulo de la subtarea es obligatorio.",
            "blank": "El titulo de la subtarea es obligatorio.",
        },
    )
    assignee_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_title(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("El titulo de la subtarea es obligatorio.")
        return stripped

    def create(self, validated_data: dict) -> SubTask:
        ticket = self.context["ticket"]
        request = self.context.get("request")
        created_by = request.user if request is not None else None

        # D30: `order` es de solo lectura -- se asigna `max(order)+1` server
        # side. Sin transaccion explicita: la ventana de carrera entre este
        # aggregate y el INSERT es aceptable (RB11, `order` es orden
        # relativo, no un indice denso).
        max_order = ticket.subtasks.aggregate(max_order=Max("order"))["max_order"] or 0

        return SubTask.objects.create(
            ticket=ticket,
            title=validated_data["title"],
            assignee_id=validated_data.get("assignee_id"),
            created_by=created_by,
            order=max_order + 1,
        )


class SubTaskUpdateSerializer(_SubTaskWriteSerializerBase):
    title = serializers.CharField(
        max_length=255,
        required=False,
        error_messages={"blank": "El titulo de la subtarea es obligatorio."},
    )
    is_done = serializers.BooleanField(required=False)
    assignee_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_title(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("El titulo de la subtarea es obligatorio.")
        return stripped

    def update(self, instance: SubTask, validated_data: dict) -> SubTask:
        fields_to_save: list[str] = []

        if "title" in validated_data:
            instance.title = validated_data["title"]
            fields_to_save.append("title")

        if "assignee_id" in validated_data:
            instance.assignee_id = validated_data["assignee_id"]
            fields_to_save.append("assignee")

        # D31: `completed_at` lo setea el servidor, nunca el cliente. Sin
        # transicion real de `is_done` no se toca (idempotencia, RB8).
        if "is_done" in validated_data:
            new_is_done = validated_data["is_done"]
            if new_is_done != instance.is_done:
                instance.is_done = new_is_done
                instance.completed_at = timezone.now() if new_is_done else None
                fields_to_save.extend(["is_done", "completed_at"])

        if fields_to_save:
            instance.save(update_fields=[*fields_to_save, "updated_at"])

        return instance
