from __future__ import annotations

from django.db import migrations

from apps.projects.backfill import backfill_project_keys


def forwards(apps, schema_editor):
    project_model = apps.get_model("projects", "Project")
    backfill_project_keys(project_model)


def reverse(apps, schema_editor):
    project_model = apps.get_model("projects", "Project")
    project_model.objects.update(key=None)


class Migration(migrations.Migration):

    atomic = True

    dependencies = [
        ("projects", "0002_project_key"),
    ]

    operations = [
        migrations.RunPython(forwards, reverse),
    ]
