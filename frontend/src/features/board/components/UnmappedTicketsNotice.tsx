import { cn } from "@/lib/utils";

/**
 * Aviso de tickets que no caen en ninguna columna del tablero porque su
 * columna de proyecto no está mapeada a ningún estado del espacio. No se
 * pintan en ninguna celda, así que sin este aviso desaparecerían en silencio.
 */
export function UnmappedTicketsNotice({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <p
      className={cn(
        "border-2 border-mustard bg-mustard/10 px-3 py-2 text-xs text-mustard",
        className,
      )}
    >
      {count} ticket(s) en columnas de proyecto que no corresponden a ningún estado del espacio.
    </p>
  );
}
