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
from apps.notifications.serializers import NotificationActionSerializer, NotificationSerializer
from apps.workspaces.models import WorkspaceInvitation, WorkspaceMember


class NotificationListView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request) -> Response:
		notifications = Notification.objects.filter(recipient=request.user)
		serializer = NotificationSerializer(notifications, many=True)
		return Response(serializer.data, status=status.HTTP_200_OK)


class NotificationMarkAllReadView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request) -> Response:
		Notification.objects.filter(recipient=request.user, is_read=False).update(
			is_read=True,
			read_at=timezone.now(),
		)
		return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationMarkReadView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request, notification_id: str) -> Response:
		notification = Notification.objects.filter(id=notification_id, recipient=request.user).first()
		if notification is None:
			raise NotFound("Notificacion no encontrada.")
		notification.mark_as_read()
		return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)


class NotificationActionView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request: Request, notification_id: str) -> Response:
		notification = (
			Notification.objects.filter(id=notification_id, recipient=request.user)
			.select_related("workspace_invitation", "workspace_invitation__workspace")
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

		if invitation.status != WorkspaceInvitation.Status.PENDING:
			raise ValidationError({"detail": "La invitacion ya fue respondida."})

		with transaction.atomic():
			workspace_name = invitation.workspace.name
			if action == "accept":
				WorkspaceMember.objects.update_or_create(
					workspace=invitation.workspace,
					user=request.user,
					defaults={"role": invitation.role},
				)
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

		return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)
