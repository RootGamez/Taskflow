import { useEffect } from "react";

import type { CommandActionHandler } from "@/store/commandActionsStore";
import { useCommandActionsStore } from "@/store/commandActionsStore";

/**
 * D8/D53 de docs/PHASE_3_PLAN.md: una pagina registra un handler (ej.
 * `"create-ticket"`) en un `useEffect` al montar y lo desregistra al
 * desmontar (RD5). Una sola fuente de verdad, consumida tanto por el
 * command palette (WP-A) como por el atajo `c` del listener global
 * (WP-D) -- ninguno de los dos sabe nada de rutas.
 *
 * `handler` acepta `null` para que el llamador pueda registrar
 * condicionalmente (ej. solo cuando el usuario tiene permiso de
 * escritura) sin romper las reglas de hooks con un `if` alrededor de la
 * llamada.
 */
export function useRegisterCommandAction(id: string, handler: CommandActionHandler | null): void {
  useEffect(() => {
    if (!handler) {
      return;
    }

    useCommandActionsStore.getState().register(id, handler);
    return () => useCommandActionsStore.getState().unregister(id);
  }, [id, handler]);
}
