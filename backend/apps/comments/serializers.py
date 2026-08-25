from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.comments.models import Comment
from apps.comments.services import MentionValidationError, validate_and_resolve_mentions, validate_body_not_empty

User = get_user_model()


class CommentAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "email")


class CommentMentionSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name")


class CommentSerializer(serializers.ModelSerializer):
    ticket_id = serializers.UUIDField(read_only=True)
    author = CommentAuthorSerializer(read_only=True)
    mentions = CommentMentionSerializer(many=True, read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "ticket_id", "author", "body", "mentions", "created_at", "edited_at")
        read_only_fields = fields


class CommentCreateSerializer(serializers.Serializer):
    """Valida el payload de creación/edición de un comentario.

    `body` se valida vacío/whitespace y menciones se resuelven con el
    pipeline de `apps.comments.services` (dedupe, límite, requisito de "@",
    filtrado por membership vigente del workspace del proyecto).
    """

    body = serializers.CharField(max_length=5000, allow_blank=True, trim_whitespace=False)
    mention_user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )

    def validate(self, attrs: dict) -> dict:
        project = self.context["project"]
        try:
            body = validate_body_not_empty(attrs.get("body", ""))
            resolved_mention_ids = validate_and_resolve_mentions(
                project.workspace, body, attrs.get("mention_user_ids", [])
            )
        except MentionValidationError as exc:
            raise serializers.ValidationError({"detail": exc.message}) from exc

        attrs["body"] = body
        attrs["mention_user_ids"] = resolved_mention_ids
        return attrs


class CommentUpdateSerializer(CommentCreateSerializer):
    """Mismo contrato/validación que la creación (D2 aplica igual al editar)."""
