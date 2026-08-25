# Separada a proposito de 0002 (esquema) y 0003 (datos): la constraint se
# agrega recien con la tabla ya backfilleada, para que una colision de
# 'key' dentro de un workspace falle aca (diagnostico simple sobre datos ya
# poblados) en vez de a mitad de 0003.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0003_backfill_project_key"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="project",
            constraint=models.UniqueConstraint(
                condition=models.Q(("key__isnull", False)),
                fields=("workspace", "key"),
                name="unique_project_key_per_workspace",
            ),
        ),
    ]
