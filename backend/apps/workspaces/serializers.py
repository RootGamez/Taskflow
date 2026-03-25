from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.notifications.models import Notification
from apps.workspaces.models import Workspace, WorkspaceInvitation, WorkspaceMember

User = get_user_model()


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


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    avatar_url = serializers.CharField(source="user.avatar_url", read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = (
            "id",
            "workspace_id",
            "user_id",
            "email",
            "full_name",
            "avatar_url",
            "role",
            "is_active",
            "created_at",
        )
        read_only_fields = fields


class WorkspaceMemberInviteSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={
            "required": "El email es obligatorio.",
            "blank": "El email es obligatorio.",
            "invalid": "Ingresa un email valido.",
        }
    )
    role = serializers.ChoiceField(
        choices=[
            WorkspaceMember.Role.ADMIN,
            WorkspaceMember.Role.MEMBER,
            WorkspaceMember.Role.VIEWER,
        ],
        default=WorkspaceMember.Role.MEMBER,
    )

    def validate_email(self, value: str) -> str:
        user = User.objects.filter(email__iexact=value).first()
        if user is None:
            raise serializers.ValidationError("No existe una cuenta con ese email.")
        self.context["target_user"] = user
        return value

    def validate(self, attrs: dict) -> dict:
        workspace: Workspace = self.context["workspace"]
        request_user = self.context["request"].user
        target_user = self.context["target_user"]
        if target_user == request_user:
            raise serializers.ValidationError("No puedes invitarte a ti mismo.")
        if WorkspaceMember.objects.filter(workspace=workspace, user=target_user).exists():
            raise serializers.ValidationError("La persona ya es miembro del workspace.")
        if WorkspaceInvitation.objects.filter(
            workspace=workspace,
            invited_user=target_user,
            status=WorkspaceInvitation.Status.PENDING,
        ).exists():
            raise serializers.ValidationError("Ya existe una invitacion pendiente para esa persona.")
        return attrs

    def create(self, validated_data: dict) -> WorkspaceInvitation:
        workspace: Workspace = self.context["workspace"]
        target_user = self.context["target_user"]
        request_user = self.context["request"].user

        with transaction.atomic():
            invitation = WorkspaceInvitation.objects.create(
                workspace=workspace,
                invited_user=target_user,
                invited_by=request_user,
                role=validated_data["role"],
                status=WorkspaceInvitation.Status.PENDING,
            )

            notification = Notification.objects.create(
                recipient=target_user,
                actor=request_user,
                notification_type=Notification.Type.WORKSPACE_INVITATION,
                title=f"Nueva invitacion a workspace \"{workspace.name}\"",
                message=f"{request_user.full_name} te invito como {validated_data['role']}.",
                data={
                    "workspace_id": str(workspace.id),
                    "workspace_slug": workspace.slug,
                    "workspace_name": workspace.name,
                    "role": validated_data["role"],
                    "invitation_id": str(invitation.id),
                    "invitation_status": WorkspaceInvitation.Status.PENDING,
                },
            )
            invitation.notification = notification
            invitation.save(update_fields=["notification"])

        return invitation


class WorkspaceMemberRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=[
            WorkspaceMember.Role.ADMIN,
            WorkspaceMember.Role.MEMBER,
            WorkspaceMember.Role.VIEWER,
        ]
    )

    def save(self, **kwargs) -> WorkspaceMember:
        membership: WorkspaceMember = self.context["membership"]
        membership.role = self.validated_data["role"]
        membership.save(update_fields=["role"])
        return membership


class WorkspaceInvitationSerializer(serializers.ModelSerializer):
    invited_user_id = serializers.UUIDField(source="invited_user.id", read_only=True)
    invited_user_email = serializers.EmailField(source="invited_user.email", read_only=True)

    class Meta:
        model = WorkspaceInvitation
        fields = (
            "id",
            "workspace_id",
            "invited_user_id",
            "invited_user_email",
            "role",
            "status",
            "created_at",
        )
        read_only_fields = fields
