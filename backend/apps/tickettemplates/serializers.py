from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from apps.tickets.models import Ticket
from apps.tickettemplates.models import TicketTemplate, TicketTemplateItem

# D25: limite de items por plantilla. Protege la ruta caliente de
# `apply_template_items` (apps.tickettemplates.services), que crea hasta
# esta cantidad de `SubTask` dentro de la transaccion de creacion de un
# ticket -- 50 deja margen bajo `MAX_SUBTASKS_PER_TICKET` (100,
# apps/subtasks/views.py).
MAX_TEMPLATE_ITEMS = 50


class TicketTemplateItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketTemplateItem
        fields = ("id", "title", "order")


class TicketTemplateSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(read_only=True)
    # Asume que el queryset ya viene con `prefetch_related("items")` desde
    # el call site (RT-10) -- no dispara una query nueva por plantilla.
    items = TicketTemplateItemSerializer(many=True, read_only=True)

    class Meta:
        model = TicketTemplate
        fields = (
            "id",
            "project_id",
            "name",
            "title_template",
            "description",
            "priority",
            "items",
            "created_at",
            "updated_at",
        )


# --- A partir de aca: serializers de escritura (D21/D25/RT-6/RT-7). ---


class _TicketTemplateWriteSerializerBase(serializers.Serializer):
    """Validaciones compartidas por create/update."""

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("El nombre de la plantilla es obligatorio.")
        return stripped

    def validate_items(self, value: list[str]) -> list[str]:
        # RT-7: strings vacios o solo espacios se descartan ANTES de contar
        # contra el limite -- ["  ", "ok", ""] cuenta como 1 item, no 3.
        cleaned = [item.strip() for item in value if item.strip()]
        if len(cleaned) > MAX_TEMPLATE_ITEMS:
            raise serializers.ValidationError("Una plantilla no puede tener mas de 50 items.")
        return cleaned

    def _validate_unique_name(self, project, name: str, exclude_pk=None) -> None:
        # Unicidad case-insensitive (mismo criterio que labels): el
        # constraint real vive en DB (`unique_ticket_template_name_per_project`
        # con `Lower("name")`); esta validacion solo da un 400 legible antes
        # de llegar al INSERT/UPDATE. La carrera entre este SELECT y el
        # INSERT la cubre el `try/except IntegrityError` de la vista (RT-6).
        queryset = project.ticket_templates.filter(name__iexact=name)
        if exclude_pk is not None:
            queryset = queryset.exclude(pk=exclude_pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe una plantilla con ese nombre en este proyecto.")

    def _replace_items(self, template: TicketTemplate, items: list[str]) -> None:
        # D21: el PATCH reemplaza el set completo -- delete + bulk_create
        # dentro de la misma transaccion que el caller (create/update de
        # abajo) ya abrio, nunca CRUD por item.
        template.items.all().delete()
        TicketTemplateItem.objects.bulk_create(
            [TicketTemplateItem(template=template, title=title, order=index) for index, title in enumerate(items, start=1)]
        )


class TicketTemplateCreateSerializer(_TicketTemplateWriteSerializerBase):
    name = serializers.CharField(
        max_length=80,
        error_messages={
            "required": "El nombre de la plantilla es obligatorio.",
            "blank": "El nombre de la plantilla es obligatorio.",
        },
    )
    title_template = serializers.CharField(max_length=255, required=False, allow_blank=True, trim_whitespace=False)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=Ticket.Priority.choices, required=False)
    items = serializers.ListField(child=serializers.CharField(allow_blank=True), required=False)

    def validate(self, attrs: dict) -> dict:
        project = self.context["project"]
        self._validate_unique_name(project, attrs["name"])
        return attrs

    def create(self, validated_data: dict) -> TicketTemplate:
        project = self.context["project"]
        request = self.context["request"]
        items = validated_data.pop("items", [])

        with transaction.atomic():
            template = TicketTemplate.objects.create(
                project=project,
                created_by=request.user,
                **validated_data,
            )
            if items:
                self._replace_items(template, items)

        return template


class TicketTemplateUpdateSerializer(_TicketTemplateWriteSerializerBase):
    name = serializers.CharField(
        max_length=80,
        required=False,
        error_messages={"blank": "El nombre de la plantilla es obligatorio."},
    )
    title_template = serializers.CharField(max_length=255, required=False, allow_blank=True, trim_whitespace=False)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=Ticket.Priority.choices, required=False)
    items = serializers.ListField(child=serializers.CharField(allow_blank=True), required=False)

    def validate(self, attrs: dict) -> dict:
        project = self.context["project"]
        instance: TicketTemplate = self.instance
        name = attrs.get("name", instance.name)
        self._validate_unique_name(project, name, exclude_pk=instance.pk)
        return attrs

    def update(self, instance: TicketTemplate, validated_data: dict) -> TicketTemplate:
        items = validated_data.pop("items", None)
        fields_to_save: list[str] = []
        for field, value in validated_data.items():
            setattr(instance, field, value)
            fields_to_save.append(field)

        with transaction.atomic():
            if fields_to_save:
                instance.save(update_fields=[*fields_to_save, "updated_at"])
            if items is not None:
                self._replace_items(instance, items)

        return instance
