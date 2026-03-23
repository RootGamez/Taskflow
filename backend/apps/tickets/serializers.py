from __future__ import annotations

from django.db import transaction
from django.db.models import F, Max
from rest_framework import serializers

from apps.projects.models import ProjectColumn
from apps.tickets.models import Ticket


def normalize_ticket_positions(ticket: Ticket, target_column: ProjectColumn, requested_order: int | None) -> tuple[ProjectColumn, int]:
    source_column = ticket.column
    source_order = ticket.order

    with transaction.atomic():
        if target_column.id == source_column.id:
            max_position = ticket.project.tickets.filter(column=source_column).exclude(id=ticket.id).aggregate(max_order=Max("order"))["max_order"] or 0
            target_order = requested_order if requested_order is not None else source_order
            target_order = max(1, min(target_order, max_position + 1))

            siblings = ticket.project.tickets.filter(column=source_column).exclude(id=ticket.id)
            if target_order > source_order:
                siblings.filter(order__gt=source_order, order__lte=target_order).update(order=F("order") - 1)
            elif target_order < source_order:
                siblings.filter(order__gte=target_order, order__lt=source_order).update(order=F("order") + 1)

            ticket.column = source_column
            ticket.order = target_order
            ticket.save(update_fields=["column", "order", "updated_at"])
            return ticket.column, ticket.order

        ticket.project.tickets.filter(column=source_column, order__gt=source_order).update(order=F("order") - 1)

        destination_max_order = ticket.project.tickets.filter(column=target_column).aggregate(max_order=Max("order"))["max_order"] or 0
        target_order = requested_order if requested_order is not None else destination_max_order + 1
        target_order = max(1, min(target_order, destination_max_order + 1))

        ticket.project.tickets.filter(column=target_column, order__gte=target_order).update(order=F("order") + 1)

        ticket.column = target_column
        ticket.order = target_order
        ticket.save(update_fields=["column", "order", "updated_at"])

        return ticket.column, ticket.order


class TicketSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(read_only=True)
    column_id = serializers.UUIDField(source="column.id", read_only=True)
    created_by = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    assignees = serializers.SerializerMethodField()
    labels = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id",
            "project_id",
            "column_id",
            "created_by",
            "title",
            "description",
            "priority",
            "order",
            "due_date",
            "created_at",
            "updated_at",
            "assignees",
            "labels",
        )

    def get_created_by(self, obj: Ticket):
        return str(obj.created_by_id) if obj.created_by_id else None

    def get_description(self, _obj: Ticket):
        return None

    def get_assignees(self, _obj: Ticket):
        return []

    def get_labels(self, _obj: Ticket):
        return []


class TicketCreateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "El titulo del ticket es obligatorio.",
            "blank": "El titulo del ticket es obligatorio.",
        },
    )
    priority = serializers.ChoiceField(choices=Ticket.Priority.choices, required=False)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    column_id = serializers.UUIDField(required=False)
    order = serializers.IntegerField(required=False, min_value=1)

    def validate_column_id(self, value):
        project = self.context["project"]
        column = project.columns.filter(id=value).first()
        if column is None:
            raise serializers.ValidationError("La columna no pertenece al proyecto.")
        self.context["column"] = column
        return value

    def create(self, validated_data: dict) -> Ticket:
        project = self.context["project"]
        request_user = self.context["request"].user

        column = self.context.get("column")
        if column is None:
            column = project.columns.order_by("order", "created_at").first()
            if column is None:
                raise serializers.ValidationError("El proyecto debe tener al menos una columna.")

        requested_order = validated_data.get("order")

        with transaction.atomic():
            max_order = project.tickets.filter(column=column).aggregate(max_order=Max("order"))["max_order"] or 0
            target_order = requested_order if requested_order is not None else max_order + 1
            target_order = max(1, min(target_order, max_order + 1))

            project.tickets.filter(column=column, order__gte=target_order).update(order=F("order") + 1)

            return Ticket.objects.create(
                project=project,
                column=column,
                created_by=request_user,
                title=validated_data["title"],
                priority=validated_data.get("priority", Ticket.Priority.NONE),
                due_date=validated_data.get("due_date"),
                order=target_order,
            )


class TicketUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False)
    priority = serializers.ChoiceField(choices=Ticket.Priority.choices, required=False)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    column_id = serializers.UUIDField(required=False)
    order = serializers.IntegerField(required=False, min_value=1)

    def validate_column_id(self, value):
        project = self.context["project"]
        column = project.columns.filter(id=value).first()
        if column is None:
            raise serializers.ValidationError("La columna no pertenece al proyecto.")
        self.context["target_column"] = column
        return value

    def update(self, instance: Ticket, validated_data: dict) -> Ticket:
        for field in ("title", "priority", "due_date"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])

        requested_order = validated_data.get("order")
        target_column = self.context.get("target_column", instance.column)

        with transaction.atomic():
            instance.save(update_fields=["title", "priority", "due_date", "updated_at"])

            if requested_order is not None or target_column.id != instance.column_id:
                normalize_ticket_positions(instance, target_column, requested_order)

        return instance
