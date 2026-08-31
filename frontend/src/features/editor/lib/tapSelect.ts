import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Distingue un "tap" de un gesto de scroll táctil dentro de una lista con
 * scroll propio.
 *
 * El bug original: los ítems del menú de bloques del editor seleccionaban en
 * `onPointerDown` + `preventDefault()`. En una pantalla táctil, empezar a
 * arrastrar el dedo para hacer scroll comienza con un `pointerdown` sobre un
 * ítem → se ejecutaba la selección y el menú se cerraba antes de poder
 * scrollear.
 *
 * Solución: no seleccionar en `pointerdown`. Guardar posición/tiempo y
 * seleccionar en `pointerup` **solo si** el dedo casi no se movió y el gesto
 * fue corto (un tap real). Cualquier desplazamiento = scroll, no se
 * selecciona. En ratón sí hacemos `preventDefault()` en `pointerdown` para no
 * perder el foco del editor antes de que corra el comando.
 */

const MOVE_THRESHOLD_PX = 10;
const MAX_TAP_MS = 600;

interface PressState {
  index: number;
  x: number;
  y: number;
  time: number;
}

export interface TapSelectHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

/**
 * @param index  Índice del ítem al que se atan estos handlers.
 * @param onSelect  Se llama con `index` cuando el gesto fue un tap real.
 * @param pressRef  Ref compartido por toda la lista (un solo gesto activo).
 */
export function createTapSelectHandlers(
  index: number,
  onSelect: (index: number) => void,
  pressRef: { current: PressState | null },
): TapSelectHandlers {
  return {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") {
        // Evita el blur del editor antes de ejecutar el comando.
        event.preventDefault();
      }
      pressRef.current = {
        index,
        x: event.clientX,
        y: event.clientY,
        time: Date.now(),
      };
    },
    onPointerUp: (event) => {
      const start = pressRef.current;
      pressRef.current = null;
      if (!start || start.index !== index) return;

      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      const elapsed = Date.now() - start.time;
      if (moved > MOVE_THRESHOLD_PX || elapsed > MAX_TAP_MS) {
        // Fue un scroll o un long-press, no un tap.
        return;
      }
      onSelect(index);
    },
    onPointerCancel: () => {
      pressRef.current = null;
    },
  };
}
