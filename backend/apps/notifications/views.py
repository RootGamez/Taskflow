from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.realtime import send_notification_event
from apps.notifications.serializers import NotificationActionSerializer, NotificationSerializer
from apps.workspaces.models import WorkspaceInvitation, WorkspaceMember
from apps.workspaces.realtime import send_workspace_event


class NotificationListView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request) -> Response:
		notifications = Notification.objects.filter(recipient=request.user)
		serializer = NotificationSerializer(notifications, many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationMarkAllReadView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request) -> Response:
		unread_ids = list(
			Notification.objects.filter(recipient=request.user, is_read=False).values_list("id", flat=True)
		)
		read_at = timezone.now()
		Notification.objects.filter(recipient=request.user, is_read=False).update(
			is_read=True,
			read_at=read_at,
		)
		if unread_ids:
			send_notification_event(
				str(request.user.id),
				{
					"type": "notification.bulk_read",
					"ids": [str(notification_id) for notification_id in unread_ids],
					"read_at": read_at.isoformat(),
				},
			)
		return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationMarkReadView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request, notification_id: str) -> Response:
		notification = Notification.objects.filter(id=notification_id, recipient=request.user).first()
		if notification is None:
			raise NotFound("Notificacion no encontrada.")
		notification.mark_as_read()
		send_notification_event(
			str(request.user.id),
			{
				"type": "notification.read",
				"notification_id": str(notification.id),
				"read_at": notification.read_at.isoformat() if notification.read_at else None,
			},
		)
		return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)


class NotificationActionView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request, notification_id: str) -> Response:
		notification = (
			Notification.objects.filter(id=notification_id, recipient=request.user)
			.select_related(
				"workspace_invitation",
				"workspace_invitation__workspace",
				"workspace_invitation__invited_user",
				"workspace_invitation__invited_by",
			)
			.first()
		)
		if notification is None:
			raise NotFound("Notificacion no encontrada.")

		serializer = NotificationActionSerializer(data=request.data)
		if not serializer.is_valid():
			raise ValidationError({"detail": "Accion invalida."})

		action = serializer.validated_data["action"]
		invitation = getattr(notification, "workspace_invitation", None)
		if invitation is None:
			raise ValidationError({"detail": "Esta notificacion no admite acciones."})

		now = timezone.now()
		if invitation.status == WorkspaceInvitation.Status.PENDING and invitation.expires_at <= now:
			invitation.status = WorkspaceInvitation.Status.EXPIRED
			invitation.responded_at = now
			invitation.save(update_fields=["status", "responded_at"])
			notification.data = {
				**notification.data,
				"invitation_status": WorkspaceInvitation.Status.EXPIRED,
			}
			notification.title = f"Invitacion expirada en workspace {invitation.workspace.name}"
			notification.message = f"La invitacion a \"{invitation.workspace.name}\" expiro."
			notification.is_read = True
			notification.read_at = now
			notification.save(update_fields=["data", "title", "message", "is_read", "read_at"])
			send_notification_event(
				str(request.user.id),
				{
					"type": "notification.updated",
					"notification": NotificationSerializer(notification).data,
				},
			)
			raise ValidationError({"detail": "La invitacion expiro."})

		if invitation.status == WorkspaceInvitation.Status.CANCELLED:
			raise ValidationError({"detail": "La invitacion expiro o fue cancelada."})

		if invitation.status != WorkspaceInvitation.Status.PENDING:
			raise ValidationError({"detail": "La invitacion ya fue respondida."})

		membership_payload = None
		with transaction.atomic():
			workspace_name = invitation.workspace.name
			if action == "accept":
				membership, _ = WorkspaceMember.objects.update_or_create(
					workspace=invitation.workspace,
					user=request.user,
					defaults={"role": invitation.role},
				)
				membership_payload = {
					"id": str(membership.id),
					"workspace_id": str(membership.workspace_id),
					"user_id": str(membership.user_id),
					"email": request.user.email,
					"full_name": request.user.full_name,
					"avatar_url": request.user.avatar_url,
					"role": membership.role,
					"is_active": membership.is_active,
					"created_at": membership.created_at.isoformat(),
				}
				invitation.status = WorkspaceInvitation.Status.ACCEPTED
				notification.title = f"Te has unido a workspace {workspace_name}"
				notification.message = f"Ahora formas parte de \"{workspace_name}\" como {invitation.role}."
			else:
				invitation.status = WorkspaceInvitation.Status.REJECTED
				notification.title = f"Invitacion rechazada en workspace {workspace_name}"
				notification.message = f"Rechazaste la invitacion a \"{workspace_name}\"."

			invitation.responded_at = timezone.now()
			invitation.save(update_fields=["status", "responded_at"])
			notification.data = {
				**notification.data,
				"invitation_status": invitation.status,
			}
			notification.is_read = True
			notification.read_at = timezone.now()
			notification.save(update_fields=["title", "message", "data", "is_read", "read_at"])

		send_notification_event(
			str(request.user.id),
			{
				"type": "notification.updated",
				"notification": NotificationSerializer(notification).data,
			},
		)

		send_workspace_event(
			str(invitation.workspace_id),
			"invitation.updated",
			{
				"invitation": {
					"id": str(invitation.id),
					"workspace_id": str(invitation.workspace_id),
					"invited_user_id": str(invitation.invited_user_id),
					"invited_user_email": invitation.invited_user.email,
					"invited_by_id": str(invitation.invited_by_id),
					"invited_by_email": invitation.invited_by.email,
					"invitation_token": str(invitation.invitation_token),
					"role": invitation.role,
					"status": invitation.status,
					"created_at": invitation.created_at.isoformat(),
					"expires_at": invitation.expires_at.isoformat(),
				},
			},
		)

		if membership_payload is not None:
			send_workspace_event(
				str(invitation.workspace_id),
				"member.joined",
				{"member": membership_payload},
			)

		return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)
