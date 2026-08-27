from __future__ import annotations

from rest_framework import serializers

from apps.labels.models import Label
from apps.labels.palette import is_valid_label_color


class LabelSerializer(serializers.ModelSerializer):
    project_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Label
        fields = ("id", "project_id", "name", "color", "created_at")


# --- A partir de aca: append-only (D37). `LabelSerializer` de arriba es
# intocable -- lo importa `apps.tickets.serializers.TicketSerializer.get_labels`
# y cambiar sus `fields` rompe ese contrato en toda la app. ---


class _LabelWriteSerializerBase(serializers.Serializer):
    """Validaciones compartidas por create/update (D38, D39, D40)."""

    def validate_name(self, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("El nombre del label es obligatorio.")
        return stripped

    def validate_color(self, value: str) -> str:
        # Normalizar a mayusculas ANTES de validar (D38): un cliente que
        # mande "#dc2626" no debe recibir un error confuso solo por el case.
        normalized = value.strip().upper()
        if not is_valid_label_color(normalized):
            raise serializers.ValidationError("El color debe ser uno de la paleta predefinida.")
        return normalized

    def _validate_unique_name(self, project, name: str, exclude_pk=None) -> None:
        # Unicidad case-insensitive (D39): el constraint real vive en DB
        # (`unique_label_name_per_project` con `Lower("name")`); esta
        # validacion solo da un 400 legible antes de llegar al INSERT/UPDATE.
        queryset = project.labels.filter(name__iexact=name)
        if exclude_pk is not None:
            queryset = queryset.exclude(pk=exclude_pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe un label con ese nombre en este proyecto.")


class LabelCreateSerializer(_LabelWriteSerializerBase):
    name = serializers.CharField(
        max_length=50,
        error_messages={
            "required": "El nombre del label es obligatorio.",
            "blank": "El nombre del label es obligatorio.",
        },
    )
    color = serializers.CharField(
        max_length=7,
        error_messages={
            "required": "El color debe ser uno de la paleta predefinida.",
            "blank": "El color debe ser uno de la paleta predefinida.",
        },
    )

    def validate(self, attrs: dict) -> dict:
        project = self.context["project"]
        self._validate_unique_name(project, attrs["name"])
        return attrs

    def create(self, validated_data: dict) -> Label:
        project = self.context["project"]
        return Label.objects.create(project=project, **validated_data)


class LabelUpdateSerializer(_LabelWriteSerializerBase):
    name = serializers.CharField(
        max_length=50,
        required=False,
        error_messages={"blank": "El nombre del label es obligatorio."},
    )
    color = serializers.CharField(
        max_length=7,
        required=False,
        error_messages={"blank": "El color debe ser uno de la paleta predefinida."},
    )

    def validate(self, attrs: dict) -> dict:
        project = self.context["project"]
        instance: Label = self.instance
        name = attrs.get("name", instance.name)
        self._validate_unique_name(project, name, exclude_pk=instance.pk)
        return attrs

    def update(self, instance: Label, validated_data: dict) -> Label:
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if validated_data:
            instance.save(update_fields=[*validated_data.keys()])
        return instance
