from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from apps.workspaces.models import Workspace, WorkspaceMember


class WorkspaceSerializer(serializers.ModelSerializer):
    owner_id = serializers.UUIDField(read_only=True)
    role = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = (
            "id",
            "name",
            "slug",
            "logo_url",
            "owner_id",
            "created_at",
            "role",
            "is_active",
        )

    def get_role(self, obj: Workspace) -> str:
        membership = self.context.get("membership_by_workspace", {}).get(obj.id)
        return membership.role if membership else WorkspaceMember.Role.VIEWER

    def get_is_active(self, obj: Workspace) -> bool:
        membership = self.context.get("membership_by_workspace", {}).get(obj.id)
        return bool(membership and membership.is_active)


class WorkspaceCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "El nombre del workspace es obligatorio.",
            "blank": "El nombre del workspace es obligatorio.",
        },
    )
    slug = serializers.SlugField(max_length=255, required=False, allow_blank=True)
    logo_url = serializers.URLField(required=False, allow_blank=True)

    def create(self, validated_data: dict) -> Workspace:
        request_user = self.context["request"].user

        with transaction.atomic():
            WorkspaceMember.objects.filter(user=request_user, is_active=True).update(is_active=False)
            workspace = Workspace.objects.create(
                name=validated_data["name"],
                slug=validated_data.get("slug", ""),
                logo_url=validated_data.get("logo_url", ""),
                owner=request_user,
            )
            WorkspaceMember.objects.create(
                workspace=workspace,
                user=request_user,
                role=WorkspaceMember.Role.OWNER,
                is_active=True,
            )

        return workspace


class WorkspaceSelectActiveSerializer(serializers.Serializer):
    workspace_id = serializers.UUIDField(
        error_messages={
            "required": "El workspace_id es obligatorio.",
            "invalid": "workspace_id invalido.",
        }
    )

    def validate_workspace_id(self, value):
        request_user = self.context["request"].user
        membership = WorkspaceMember.objects.filter(user=request_user, workspace_id=value).first()
        if membership is None:
            raise serializers.ValidationError("No tienes acceso a este workspace.")
        self.context["membership"] = membership
        return value

    def save(self, **kwargs):
        request_user = self.context["request"].user
        membership = self.context["membership"]

        with transaction.atomic():
            WorkspaceMember.objects.filter(user=request_user, is_active=True).update(is_active=False)
            membership.is_active = True
            membership.save(update_fields=["is_active"])

        return membership
