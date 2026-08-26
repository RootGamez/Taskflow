// D48: no redefinir `Label` en el frontend, re-exportarlo. `ticket.types.ts`
// ya lo define y `features/tickets/index.ts` ya lo exporta — dos
// definiciones competidoras del mismo tipo es la receta para un bug de
// tipos silencioso.
export type { Label } from "@/features/tickets/types/ticket.types";
