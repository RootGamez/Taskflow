from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import F, Max
from rest_framework import serializers

import apps.activities.services as activities_services
import apps.notifications.services as notifications_services
import apps.tickettemplates.services as tickettemplates_services
from apps.activities.models import Activity
from apps.labels.serializers import LabelSerializer
from apps.projects.models import ProjectColumn
from apps.tickets.models import Ticket
from apps.tickets.numbering import allocate_ticket_number
from apps.tickets.rich_text import extract_plain_text
from apps.users.serializers import UserSerializer

logger = logging.getLogger(__name__)


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
    project = serializers.SerializerMethodField()
    column_id = serializers.UUIDField(source="column.id", read_only=True)
    workspace_status_id = serializers.SerializerMethodField()
    sprint_ids = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    assignees = UserSerializer(many=True, read_only=True)
    labels = serializers.SerializerMethodField()
    number = serializers.IntegerField(read_only=True)
    reference = serializers.SerializerMethodField()
    subtask_count = serializers.SerializerMethodField()
    completed_subtask_count = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id",
            "project_id",
            "project",
            "column_id",
            "workspace_status_id",
            "sprint_ids",
            "created_by",
            "title",
            "description",
            "progress_notes",
            "priority",
            "order",
            "due_date",
            "created_at",
            "updated_at",
            "assignees",
            "labels",
            "number",
            "reference",
            "subtask_count",
            "completed_subtask_count",
        )

    def get_created_by(self, obj: Ticket):
        return str(obj.created_by_id) if obj.created_by_id else None

    def get_project(self, obj: Ticket):
        # Asume `select_related("project")` desde el call site (todos los
        # actuales lo tienen). El tablero de sprint cruza proyectos, asi que
        # cada ticket necesita saber a cual pertenece.
        project = obj.project
        return {
            "id": str(project.id),
            "name": project.name,
            "key": project.key,
            "color": project.color,
        }

    def get_workspace_status_id(self, obj: Ticket):
        # Asume `select_related("column")` (o `column__workspace_status`).
        status_id = getattr(obj.column, "workspace_status_id", None)
        return str(status_id) if status_id else None

    def get_sprint_ids(self, obj: Ticket):
        # Asume `prefetch_related("sprints")` desde el call site.
        return [str(sprint.id) for sprint in obj.sprints.all()]

    def get_labels(self, obj: Ticket):
        return LabelSerializer(obj.labels.all(), many=True).data

    def get_reference(self, obj: Ticket):
        # Asume que `obj.project` ya viene con `select_related("project")`
        # desde el call site (ver apps/tickets/views.py y
        # apps/tickets/consumers.py) -- no dispara una query nueva aca.
        if obj.project.key and obj.number:
            return f"{obj.project.key}-{obj.number}"
        return None

    def get_subtask_count(self, obj: Ticket):
        # `len(obj.subtasks.all())`, no `.count()` (D12 de
        # docs/PHASE_3_PLAN.md): con `prefetch_related("subtasks")` (los 6
        # call sites de listado) esto es 0 queries extra -- `.count()`
        # dispararia un COUNT(*) nuevo por ticket incluso con el
        # related manager ya prefetcheado. Sin prefetch (consumers.py,
        # que serializa un unico ticket) sigue siendo 1 query, aceptable.
        return len(obj.subtasks.all())

    def get_completed_subtask_count(self, obj: Ticket):
        return sum(1 for subtask in obj.subtasks.all() if subtask.is_done)


class TicketCreateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "El titulo del ticket es obligatorio.",
            "blank": "El titulo del ticket es obligatorio.",
        },
    )
    description = serializers.CharField(required=False, allow_blank=True)
    progress_notes = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=Ticket.Priority.choices, required=False)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    column_id = serializers.UUIDField(required=False)
    order = serializers.IntegerField(required=False, min_value=1)
    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )
    sprint_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )
    label_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )
    # docs/PHASE_4_PLAN.md D20/R0A-3: `required=False` a proposito -- un
    # POST sin `template_id` (el 100% del trafico de hoy) tiene que
    # producir exactamente el mismo resultado que antes de este campo.
    # `write_only=True`: nunca debe aparecer en la respuesta (el ticket
    # creado se re-serializa con `TicketSerializer`, que ni siquiera
    # declara este campo, pero se marca explicito igual para que quede
    # documentado en el propio serializer).
    template_id = serializers.UUIDField(required=False, write_only=True)

    def validate_column_id(self, value):
        project = self.context["project"]
        column = project.columns.filter(id=value).first()
        if column is None:
            raise serializers.ValidationError("La columna no pertenece al proyecto.")
        self.context["column"] = column
        return value

    def validate_sprint_ids(self, value):
        if not value:
            return value
        project = self.context["project"]
        unique_ids = set(value)
        valid_count = project.workspace.sprints.filter(id__in=unique_ids).count()
        if valid_count != len(unique_ids):
            raise serializers.ValidationError("Uno o mas sprints no pertenecen al espacio.")
        return value

    def validate_label_ids(self, value):
        project = self.context["project"]
        valid_count = project.labels.filter(id__in=value).count()
        if valid_count != len(set(value)):
            raise serializers.ValidationError("Uno o mas labels no pertenecen al proyecto.")
        return value

    def validate_template_id(self, value):
        # Scopeada al proyecto ya resuelto en el context (RT-4 de
        # docs/PHASE_4_PLAN.md): una plantilla de otro proyecto -- incluso
        # de otro workspace -- da el mismo 400 generico, sin filtrar su
        # nombre.
        project = self.context["project"]
        template = project.ticket_templates.filter(id=value).first()
        if template is None:
            raise serializers.ValidationError("La plantilla no pertenece a este proyecto.")
        self.context["template"] = template
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

            description = validated_data.get("description", "")
            ticket = Ticket.objects.create(
                project=project,
                column=column,
                created_by=request_user,
                title=validated_data["title"],
                description=description,
                # D11: se calcula en el serializer, nunca en Model.save() ni
                # en un signal -- este es uno de los dos unicos caminos de
                # escritura de `description` (el otro es
                # TicketUpdateSerializer.update, mas abajo).
                description_text=extract_plain_text(description),
                progress_notes=validated_data.get("progress_notes", ""),
                priority=validated_data.get("priority", Ticket.Priority.NONE),
                due_date=validated_data.get("due_date"),
                order=target_order,
                number=allocate_ticket_number(project),
            )

            if "assignee_ids" in validated_data:
                ticket.assignees.set(validated_data["assignee_ids"])

            if "label_ids" in validated_data:
                ticket.labels.set(validated_data["label_ids"])

            if "sprint_ids" in validated_data:
                ticket.sprints.set(validated_data["sprint_ids"])

            # D20 de docs/PHASE_4_PLAN.md: solo el checklist de la
            # plantilla se aplica en el servidor (titulo/descripcion/
            # prioridad ya los mando el cliente como campos normales,
            # arriba). `self.context.get("template")` viene de
            # `validate_template_id` -- ausente si no se mando
            # `template_id` (el 100% del trafico de hoy, R0A-3). El stub
            # de WP-0A (`apps.tickettemplates.services.apply_template_
            # items`) siempre devuelve 0 sin tocar la DB; WP-T reescribe
            # su cuerpo sin que este call site vuelva a cambiar.
            template = self.context.get("template")
            if template is not None:
                tickettemplates_services.apply_template_items(ticket, template, request_user)

        # Fuera de la transacción: el único evento `created` de este ticket,
        # nunca acompañado de status_changed/assigned por los valores
        # iniciales (esos no son "cambios", son el estado inicial).
        #
        # Envuelto en try/except a propósito: el ticket YA se guardó (la
        # transacción de arriba ya cerró). Un bug en el registro de
        # actividad es un problema de observabilidad, no debe convertirse en
        # un 500 sobre una creación de ticket que en realidad funcionó.
        request = self.context.get("request")
        actor = request.user if request is not None else None
        try:
            activities_services.record_ticket_created(ticket, actor)
        except Exception:
            logger.exception("No se pudo registrar la actividad 'created' del ticket %s", ticket.id)

        return ticket


class TicketUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    progress_notes = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=Ticket.Priority.choices, required=False)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    column_id = serializers.UUIDField(required=False)
    # Usado por el tablero de sprint (cruza proyectos): en vez de mandar el
    # `column_id` concreto (que el cliente del tablero no conoce por
    # proyecto), manda el estado del espacio destino y el servidor resuelve
    # la columna del proyecto del ticket mapeada a ese estado.
    workspace_status_id = serializers.UUIDField(required=False, write_only=True)
    order = serializers.IntegerField(required=False, min_value=1)
    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )
    sprint_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )
    label_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )

    def validate_column_id(self, value):
        project = self.context["project"]
        column = project.columns.filter(id=value).first()
        if column is None:
            raise serializers.ValidationError("La columna no pertenece al proyecto.")
        self.context["target_column"] = column
        return value

    def validate_workspace_status_id(self, value):
        project = self.context["project"]
        column = (
            project.columns.filter(workspace_status_id=value)
            .order_by("order", "created_at")
            .first()
        )
        if column is None:
            raise serializers.ValidationError(
                f"El proyecto \"{project.name}\" no tiene una columna para este estado."
            )
        self.context["target_column"] = column
        return value

    def validate_sprint_ids(self, value):
        if not value:
            return value
        project = self.context["project"]
        unique_ids = set(value)
        valid_count = project.workspace.sprints.filter(id__in=unique_ids).count()
        if valid_count != len(unique_ids):
            raise serializers.ValidationError("Uno o mas sprints no pertenecen al espacio.")
        return value

    def validate_label_ids(self, value):
        project = self.context["project"]
        valid_count = project.labels.filter(id__in=value).count()
        if valid_count != len(set(value)):
            raise serializers.ValidationError("Uno o mas labels no pertenecen al proyecto.")
        return value

    def update(self, instance: Ticket, validated_data: dict) -> Ticket:
        # Snapshot ANTES de mutar nada — incluido antes del `.set()` de
        # assignees más abajo — para poder diffear contra el estado
        # post-guardado en `record_ticket_changes`.
        snapshot = activities_services.take_snapshot(instance)

        # Build update_fields dynamically — only touch what was actually sent in the PATCH
        scalar_fields = ("title", "description", "progress_notes", "priority", "due_date")
        fields_to_save: list[str] = []
        for field in scalar_fields:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
                fields_to_save.append(field)

        # D11: `description_text` solo se toca cuando el PATCH manda
        # `description` -- un PATCH que solo cambia el titulo (u otro
        # campo cualquiera) no debe recalcular ni reescribir la columna.
        if "description" in validated_data:
            instance.description_text = extract_plain_text(validated_data["description"])
            fields_to_save.append("description_text")

        requested_order = validated_data.get("order")
        target_column = self.context.get("target_column", instance.column)

        # `"sprint_ids" in validated_data` (no `.get()`) a proposito: hay que
        # distinguir "no lo mandaron" (no tocar los sprints) de "lo mandaron
        # como []" (sacar el ticket de todos los sprints -> Backlog). Mismo
        # patron ya usado para `assignee_ids` en este mismo metodo.

        with transaction.atomic():
            if fields_to_save:
                instance.save(update_fields=[*fields_to_save, "updated_at"])

            if requested_order is not None or target_column.id != instance.column_id:
                normalize_ticket_positions(instance, target_column, requested_order)

            # Set M2M assignees inside the same transaction for atomicity
            if "assignee_ids" in validated_data:
                instance.assignees.set(validated_data["assignee_ids"])

            if "label_ids" in validated_data:
                instance.labels.set(validated_data["label_ids"])

            # Cambiar de sprints nunca pasa por `normalize_ticket_positions`:
            # no es un movimiento de columna, no debe tocar `order`.
            if "sprint_ids" in validated_data:
                instance.sprints.set(validated_data["sprint_ids"])

        # Fuera de la transacción: si algo de esto fallara no queremos
        # actividades/notificaciones huérfanas de un update que se revirtió.
        # `actor` viene en el context desde los dos call sites compartidos
        # (TicketDetailView.patch y TicketConsumer._patch_ticket).
        #
        # Envuelto en try/except a propósito: el update del ticket YA se
        # guardó (la transacción de arriba ya cerró). Este bloque es
        # actividad/notificaciones, un efecto secundario — no debe poder
        # tumbar la respuesta HTTP ni, peor, cortar la conexión de
        # WebSocket del panel de detalle (TicketConsumer no envuelve
        # `_patch_ticket` en try/except, así que una excepción acá se
        # propagaría hasta el consumer).
        actor = self.context.get("actor")
        try:
            changes = activities_services.record_ticket_changes(instance, actor, snapshot)
            added_ids = [
                activity.to_value["id"] for activity in changes if activity.action == Activity.Action.ASSIGNED
            ]
            notifications_services.notify_ticket_assigned(instance, actor, added_ids)
        except Exception:
            logger.exception("No se pudo registrar actividad/notificar cambios del ticket %s", instance.id)

        return instance
