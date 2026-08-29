from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.goals.models import WeeklyBoard, WeeklyGoalItem

User = get_user_model()


class GoalItemUserSerializer(serializers.ModelSerializer):
    """Usuario minimo embebido en `completed_by`. Mismo shape que
    `apps.comments.serializers.CommentAuthorSerializer` (`id` + `full_name` +
    `email`) para que el frontend reuse el mismo componente de avatar/nombre.
    """

    class Meta:
        model = User
        fields = ("id", "full_name", "email")
        read_only_fields = fields


class WeeklyGoalItemSerializer(serializers.ModelSerializer):
    completed_by = GoalItemUserSerializer(read_only=True)

    class Meta:
        model = WeeklyGoalItem
        fields = (
            "id",
            "text",
            "is_done",
            "order",
            "completed_by",
            "completed_at",
            "created_at",
        )
        read_only_fields = fields


class WeeklyBoardSerializer(serializers.ModelSerializer):
    """Respuesta de `GET /weekly-board/`. `can_manage` se pasa por contexto
    desde la vista (es `True` sii el solicitante es OWNER/ADMIN) -- el frontend
    lo usa para decidir si muestra los controles de edicion.
    """

    items = WeeklyGoalItemSerializer(many=True, read_only=True)
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyBoard
        fields = ("id", "week_start", "items", "can_manage", "created_at")
        read_only_fields = fields

    def get_can_manage(self, obj: WeeklyBoard) -> bool:
        return bool(self.context.get("can_manage", False))


class WeeklyGoalItemCreateSerializer(serializers.Serializer):
    """Body de `POST /weekly-board/items/`: solo `text`. `order` lo asigna el
    servidor (RG3), nunca el cliente.
    """

    text = serializers.CharField(
        max_length=200,
        error_messages={
            "required": "El texto de la meta es obligatorio.",
            "blank": "El texto de la meta es obligatorio.",
        },
    )

    def validate_text(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("El texto de la meta es obligatorio.")
        return stripped


class WeeklyGoalItemUpdateSerializer(serializers.Serializer):
    """Body de `PATCH /weekly-board/items/<id>/`: todos los campos opcionales.

    Que campos vengan en el body determina el permiso requerido (RD-2): si solo
    viene `is_done`, cualquier miembro; si viene `text` u `order`, OWNER/ADMIN.
    Ese gate vive en la vista, no aca.
    """

    text = serializers.CharField(
        max_length=200,
        required=False,
        error_messages={"blank": "El texto de la meta es obligatorio."},
    )
    is_done = serializers.BooleanField(required=False)
    order = serializers.IntegerField(required=False, min_value=0)

    def validate_text(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("El texto de la meta es obligatorio.")
        return stripped
