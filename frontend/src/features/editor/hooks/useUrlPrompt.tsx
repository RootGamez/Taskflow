"use client";

import { useCallback, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { normalizeUrl } from "../lib/url";

/**
 * Reemplazo de `window.prompt` para pedir una URL desde el editor.
 * `window.prompt` se traba dentro de un modal con focus-trap (Radix) y no
 * permite validación. Este hook expone:
 *   - `requestUrl(title?)` → `Promise<string | null>` (URL ya normalizada, o
 *     `null` si el usuario cancela)
 *   - `urlPromptDialog` → el JSX del diálogo, para renderizar en el editor.
 */
export function useUrlPrompt() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Introduce una URL");
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const normalized = normalizeUrl(value);
  const showError = touched && value.trim().length > 0 && !normalized;

  const finish = useCallback((result: string | null) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOpen(false);
    setValue("");
    setTouched(false);
  }, []);

  const requestUrl = useCallback((promptTitle = "Introduce una URL") => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current?.(null); // resuelve una petición previa colgada
      resolveRef.current = resolve;
      setTitle(promptTitle);
      setValue("");
      setTouched(false);
      setOpen(true);
    });
  }, []);

  const urlPromptDialog = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish(null);
      }}
    >
      <DialogContent className="sm:max-w-md" data-ticket-editor-floating="true">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Escribe o pega una dirección web.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (normalized) finish(normalized);
          }}
          className="space-y-3"
        >
          <Input
            autoFocus
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={showError}
          />
          {showError ? (
            <p className="text-xs text-destructive">Introduce una URL http(s) válida.</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => finish(null)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!normalized}>
              Insertar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { requestUrl, urlPromptDialog };
}

export type RequestUrlFn = ReturnType<typeof useUrlPrompt>["requestUrl"];
