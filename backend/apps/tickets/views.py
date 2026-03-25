from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import F
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project
from apps.tickets.consumers import TicketConsumer
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketCreateSerializer, TicketSerializer, TicketUpdateSerializer
from apps.workspaces.access import WorkspaceRoleAccessMixin


class TicketListCreateView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, project_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		tickets = project.tickets.select_related("column", "created_by").order_by("column__order", "order", "created_at")
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
		return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


class TicketDetailView(WorkspaceRoleAccessMixin, APIView):
	permission_classes = [IsAuthenticated]

	def patch(self, request: Request, project_id: str, ticket_id: str) -> Response:
		project = self.get_project_for_user(request, project_id)
		self.assert_project_write_access(request, project)
		ticket = project.tickets.select_related("column", "created_by").filter(id=ticket_id).first()
		if ticket is None:
			raise NotFound("Ticket no encontrado.")

		request_fields = set(request.data.keys())
		for field in TicketConsumer.EDITABLE_FIELDS.intersection(request_fields):
			lock = TicketConsumer.get_active_lock(str(ticket.id), field)
			if lock and lock.get("user_id") != str(request.user.id):
				owner = lock.get("user_name", "Otro usuario")
				raise ValidationError({"detail": f"{owner} esta editando este campo, por favor espera."})

		serializer = TicketUpdateSerializer(
			ticket,
			data=request.data,
			partial=True,
			context={"project": project},
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

		channel_layer = get_channel_layer()
		if channel_layer is not None:
			async_to_sync(channel_layer.group_send)(
				f"ticket_{updated_ticket.id}",
				{
					"type": "ticket.updated",
					"ticket": TicketSerializer(updated_ticket).data,
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

		return Response(status=status.HTTP_204_NO_CONTENT)


class TicketSingleView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request: Request, ticket_id: str) -> Response:
		ticket = (
			Ticket.objects.select_related("project__workspace", "column", "created_by")
			.filter(id=ticket_id, project__workspace__memberships__user=request.user)
			.distinct()
			.first()
		)
		if ticket is None:
			raise NotFound("Ticket no encontrado.")

		return Response(TicketSerializer(ticket).data, status=status.HTTP_200_OK)
