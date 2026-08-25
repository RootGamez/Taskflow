"""Paleta curada de colores para labels (docs/DESIGN_SYSTEM.md, seccion 8.4).

El diseno pide 8-10 colores predefinidos en vez de un color picker libre,
para evitar reabrir el problema de contraste ya resuelto para columnas de
Kanban (texto nunca sobre el color crudo al 100%, sino `bg-{color}/15` +
el color solido como texto/borde).

Los 10 hex elegidos son los mismos 8 ya usados como paleta curada de color
de proyecto (`frontend/src/features/projects/components/CreateProjectModal.tsx`)
mas 2 adicionales (rosa y ambar) en la misma familia de saturacion
(Tailwind 600/700), para que un label se sienta visualmente consistente con
el resto de la app y mantenga suficiente contraste tanto en tema claro como
oscuro cuando se usa como texto/borde solido sobre un fondo `/15`.
"""

from __future__ import annotations

LABEL_COLORS: tuple[str, ...] = (
    "#2563EB",  # blue-600
    "#16A34A",  # green-600
    "#0891B2",  # cyan-600
    "#EA580C",  # orange-600
    "#9333EA",  # purple-600
    "#DC2626",  # red-600
    "#64748B",  # slate-500
    "#0F766E",  # teal-700
    "#DB2777",  # pink-600
    "#CA8A04",  # amber-600
)


def is_valid_label_color(value: str) -> bool:
    """True si `value` es uno de los hex exactos de `LABEL_COLORS`.

    Comparacion case-sensitive a proposito: `LABEL_COLORS` ya esta
    normalizado en mayusculas, y forzar al caller a mandar el mismo formato
    evita normalizar en dos lugares distintos (acá y en el serializer).
    """
    return value in LABEL_COLORS
