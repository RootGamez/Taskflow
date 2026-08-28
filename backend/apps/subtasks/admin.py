from django.contrib import admin

# Registro de `SubTask` reservado para WP-B, que agrega el `ModelAdmin`
# (list_display/list_filter) una vez que el modelo tiene serializers/vistas
# propios. Registrar aca sin eso todavia seria admin sin uso real.
