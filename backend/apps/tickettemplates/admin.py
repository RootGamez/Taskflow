from django.contrib import admin

# Registro de `TicketTemplate`/`TicketTemplateItem` reservado para WP-T,
# que agrega el `ModelAdmin` (list_display/list_filter) una vez que los
# modelos tienen serializers/vistas propios. Registrar aca sin eso
# todavia seria admin sin uso real.
