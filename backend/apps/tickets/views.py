from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project
from apps.tickets.consumers import TicketConsumer
from apps.tickets.filters import apply_ticket_date_filters, parse_ticket_date_filters
from apps.tickets.models import Ticket, TicketFieldLock, TicketImage, TicketVideo
from apps.tickets.serializers import TicketCreateSerializer, TicketSerializer, TicketUpdateSerializer
from apps.tickets.storage import upload_ticket_image, upload_ticket_video
from apps.workspaces.access import WorkspaceRoleAccessMixin


class TicketListCreateView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, project_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		date_filters = parse_ticket_date_filters(request.query_params)
		tickets = (
			project.tickets.select_related("project", "column", "created_by", "sprint")
			.prefetch_related("assignees", "labels")
		)
		tickets = apply_ticket_date_filters(tickets, date_filters)
		tickets = tickets.order_by("column__order", "order", "created_at")
		return Response(TicketSerializer(tickets, many=True).data, status=status.HTTP_200_OK)

	def post(self, request: Request, project_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)
		serializer = TicketCreateSerializer(
			data=request.data,
			context={"project": project, "request": request},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo crear el ticket."
			raise ValidationError({"detail": message})

		ticket = serializer.save()
		ticket = (
			project.tickets.select_related("project", "column", "created_by", "sprint")
			.prefetch_related("assignees", "labels")
			.get(id=ticket.id)
		)
		serialized_ticket = TicketSerializer(ticket).data

		channel_layer = get_channel_layer()
		if channel_layer is not None:
			async_to_sync(channel_layer.group_send)(
				f"project_{project_id}",
				{
					"type": "ticket.created",
					"ticket": serialized_ticket,
					"source": str(request.user.id),
				},
			)

		return Response(serialized_ticket, status=status.HTTP_201_CREATED)


class TicketDetailView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def patch(self, request: Request, project_id: str, ticket_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)
		ticket = (
			project.tickets.select_related("project", "column", "created_by", "sprint")
			.filter(id=ticket_id)
			.first()
		)
		if ticket is None:
			raise NotFound("Ticket no encontrado.")

		request_fields = set(request.data.keys())
		now = timezone.now()
		for field in TicketConsumer.EDITABLE_FIELDS.intersection(request_fields):
			lock = TicketFieldLock.objects.filter(ticket=ticket, field=field).first()
			if lock and lock.expires_at <= now:
				lock.delete()
				lock = None
			if lock and str(lock.user_id) != str(request.user.id):
				owner = lock.user_name or "Otro usuario"
				raise ValidationError({"detail": f"{owner} esta editando este campo, por favor espera."})

		serializer = TicketUpdateSerializer(
			ticket,
			data=request.data,
			partial=True,
			context={"project": project, "actor": request.user},
		)
		if not serializer.is_valid():
			errors = serializer.errors
			first_error = next(iter(errors.values()), None)
			if isinstance(first_error, list) and first_error:
				message = str(first_error[0])
			else:
				message = "No se pudo actualizar el ticket."
			raise ValidationError({"detail": message})

		updated_ticket = serializer.save()
		updated_ticket = (
			Ticket.objects.select_related("project__workspace", "column", "created_by", "sprint")
			.prefetch_related("assignees", "labels")
			.get(id=updated_ticket.id)
		)

		channel_layer = get_channel_layer()
		if channel_layer is not None:
			serialized_ticket = TicketSerializer(updated_ticket).data
			async_to_sync(channel_layer.group_send)(
				f"ticket_{updated_ticket.id}",
				{
					"type": "ticket.updated",
					"ticket": serialized_ticket,
					"source": str(request.user.id),
				},
			)
			async_to_sync(channel_layer.group_send)(
				f"project_{project_id}",
				{
					"type": "ticket.updated",
					"ticket": serialized_ticket,
					"source": str(request.user.id),
				},
			)

		return Response(TicketSerializer(updated_ticket).data, status=status.HTTP_200_OK)

	def delete(self, request: Request, project_id: str, ticket_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)
		ticket = project.tickets.filter(id=ticket_id).first()
		if ticket is None:
			raise NotFound("Ticket no encontrado.")

		with transaction.atomic():
			column_id = ticket.column_id
			deleted_order = ticket.order
			ticket.delete()
			project.tickets.filter(column_id=column_id, order__gt=deleted_order).update(order=F("order") - 1)

		channel_layer = get_channel_layer()
		if channel_layer is not None:
			async_to_sync(channel_layer.group_send)(
				f"project_{project_id}",
				{
					"type": "ticket.deleted",
					"ticket_id": str(ticket_id),
					"project_id": str(project_id),
					"column_id": str(column_id),
					"source": str(request.user.id),
				},
			)

		return Response(status=status.HTTP_204_NO_CONTENT)


class TicketSingleView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, ticket_id: str) -> Response:
		ticket = (
			Ticket.objects.select_related("project__workspace", "column", "created_by", "sprint")
			.prefetch_related("assignees", "labels")
			.filter(id=ticket_id, project__workspace__memberships__user=request.user)
			.distinct()
			.first()
		)
		if ticket is None:
			raise NotFound("Ticket no encontrado.")

		return Response(TicketSerializer(ticket).data, status=status.HTTP_200_OK)


class TicketImageUploadView(WorkspaceRoleAccessMixin, APIView):
	"""Recibe una imagen, la sube a MinIO y devuelve la URL pública.

	Endpoint: POST /api/v1/projects/<project_id>/tickets/<ticket_id>/images/
	Body: multipart/form-data con campo 'image'.
	Respuesta 201: { "url": "https://..." }
	"""

	permission_classes = [IsAuthenticated]
	parser_classes = [MultiPartParser, FormParser]

	def post(self, request: Request, project_id: str, ticket_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)

		ticket = project.tickets.filter(id=ticket_id).first()
		if ticket is None:
			raise NotFound("Ticket no encontrado.")

		image_file = request.FILES.get("image")
		if image_file is None:
			raise ValidationError({"detail": "Debes adjuntar un campo 'image'."})

		try:
			object_key, public_url = upload_ticket_image(
				image_file,
				ticket_id=str(ticket.id),
				user_id=str(request.user.id),
			)
		except ValueError as exc:
			raise ValidationError({"detail": str(exc)}) from exc
		except Exception as exc:
			raise ValidationError({"detail": "No se pudo subir la imagen."}) from exc

		ticket_image = TicketImage.objects.create(
			ticket=ticket,
			uploaded_by=request.user,
			object_key=object_key,
			url=public_url,
			file_name=image_file.name or "",
			content_type=image_file.content_type or "",
			file_size=image_file.size or 0,
		)

		return Response(
			{"url": ticket_image.url, "id": str(ticket_image.id)},
			status=status.HTTP_201_CREATED,
		)

class TicketVideoUploadView(WorkspaceRoleAccessMixin, APIView):
	"""Recibe un video, lo sube a MinIO y devuelve la URL pública.

	Endpoint: POST /api/v1/projects/<project_id>/tickets/<ticket_id>/videos/
	Body: multipart/form-data con campo 'video'.
	Respuesta 201: { "url": "https://..." }
	"""

	permission_classes = [IsAuthenticated]
	parser_classes = [MultiPartParser, FormParser]

	def post(self, request: Request, project_id: str, ticket_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)

		ticket = project.tickets.filter(id=ticket_id).first()
		if ticket is None:
			raise NotFound("Ticket no encontrado.")

		video_file = request.FILES.get("video")
		if video_file is None:
			raise ValidationError({"detail": "Debes adjuntar un campo 'video'."})

		try:
			object_key, public_url = upload_ticket_video(
				video_file,
				ticket_id=str(ticket.id),
				user_id=str(request.user.id),
			)
		except ValueError as exc:
			raise ValidationError({"detail": str(exc)}) from exc
		except Exception as exc:
			raise ValidationError({"detail": "No se pudo subir el video."}) from exc

		ticket_video = TicketVideo.objects.create(
			ticket=ticket,
			uploaded_by=request.user,
			object_key=object_key,
			url=public_url,
			file_name=video_file.name or "",
			content_type=video_file.content_type or "",
			file_size=video_file.size or 0,
		)

		return Response(
			{"url": ticket_video.url, "id": str(ticket_video.id)},
			status=status.HTTP_201_CREATED,
		)
