import axios from "axios";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/shadcn/button";
import { PageBreadcrumb } from "@/features/pages/components/PageBreadcrumb";
import { PageDeleteDialog } from "@/features/pages/components/PageDeleteDialog";
import { PageEditorHeader } from "@/features/pages/components/PageEditorHeader";
import { usePage } from "@/features/pages/hooks/usePage";
import { useDeletePage, useUpdatePage } from "@/features/pages/hooks/usePages";
import type { UpdatePagePayload } from "@/features/pages/types/page.types";
import { TicketRichEditor } from "@/features/tickets/components/TicketRichEditor";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useDebounce } from "@/hooks/useDebounce";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

const AUTOSAVE_DEBOUNCE_MS = 500;

type SaveStatus = "idle" | "saving" | "saved" | "conflict";

interface SavedSnapshot {
  title: string;
  icon: string;
  contentJson: string;
  updatedAt: string;
}

function parseContentJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <span className="text-xs text-muted-foreground">Guardando…</span>;
  }
  if (status === "saved") {
    return <span className="text-xs text-muted-foreground">Guardado</span>;
  }
  if (status === "conflict") {
    return <span className="text-xs text-destructive">Modificada por otra persona — recargá antes de seguir.</span>;
  }
  return null;
}

/**
 * Editor de pagina (D18 de docs/PHASE_4_PLAN.md): titulo + icono
 * (`PageEditorHeader`) + breadcrumb + `TicketRichEditor` (D7: se reusa
 * tal cual, sus props son agnosticas de ticket). Autoguarda con debounce
 * (D14): concurrencia optimista via `expected_updated_at`, mandado SOLO
 * en los PATCH que incluyen `content` -- un rename o cambio de icono
 * solo no lo necesita.
 */
export default function PageDetailPage() {
  const { workspaceSlug = "", pageId = "" } = useParams();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canEdit = canMutateWorkspace(activeWorkspace?.role);

  const { data: page, isLoading } = usePage(workspaceSlug, pageId);
  const updatePage = useUpdatePage(workspaceSlug, pageId);
  const deletePage = useDeletePage(workspaceSlug);

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [contentJson, setContentJson] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  const hydratedIdRef = useRef<string | null>(null);
  const lastSavedRef = useRef<SavedSnapshot | null>(null);
  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    if (!page || hydratedIdRef.current === page.id) {
      return;
    }
    hydratedIdRef.current = page.id;
    lastSavedRef.current = {
      title: page.title,
      icon: page.icon,
      contentJson: page.content,
      updatedAt: page.updated_at,
    };
    skipNextSaveRef.current = true;
    setTitle(page.title);
    setIcon(page.icon);
    setContentJson(page.content);
    setSaveStatus("idle");
  }, [page]);

  const debouncedTitle = useDebounce(title, AUTOSAVE_DEBOUNCE_MS);
  const debouncedIcon = useDebounce(icon, AUTOSAVE_DEBOUNCE_MS);
  const debouncedContentJson = useDebounce(contentJson, AUTOSAVE_DEBOUNCE_MS);

  useEffect(() => {
    const saved = lastSavedRef.current;
    if (!saved || !canEdit) {
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const payload: UpdatePagePayload = {};
    if (debouncedTitle !== saved.title) {
      payload.title = debouncedTitle;
    }
    if (debouncedIcon !== saved.icon) {
      payload.icon = debouncedIcon;
    }
    if (debouncedContentJson !== saved.contentJson) {
      payload.content = debouncedContentJson;
      payload.expected_updated_at = saved.updatedAt;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    setSaveStatus("saving");
    updatePage
      .mutateAsync(payload)
      .then((updated) => {
        lastSavedRef.current = {
          title: updated.title,
          icon: updated.icon,
          contentJson: updated.content,
          updatedAt: updated.updated_at,
        };
        setSaveStatus("saved");
      })
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          setSaveStatus("conflict");
          return;
        }
        toast.error(getApiErrorMessage(error, "No se pudo guardar la página"));
        setSaveStatus("idle");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedIcon, debouncedContentJson, canEdit]);

  if (isLoading || !page) {
    return <LoadingSpinner />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-16">
      <div className="flex items-center justify-between gap-3">
        <PageBreadcrumb workspaceSlug={workspaceSlug} breadcrumb={page.breadcrumb} />
        <div className="flex shrink-0 items-center gap-3">
          <SaveIndicator status={saveStatus} />
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Eliminar página"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <PageEditorHeader icon={icon} title={title} canEdit={canEdit} onIconChange={setIcon} onTitleChange={setTitle} />

      <TicketRichEditor
        value={parseContentJson(contentJson)}
        disabled={!canEdit}
        placeholder="Escribe algo, o usa «/» para ver los comandos..."
        onChange={(value) => setContentJson(JSON.stringify(value))}
      />

      <PageDeleteDialog
        isOpen={isDeleteOpen}
        onOpenChange={setDeleteOpen}
        pageTitle={page.title}
        descendantCount={page.child_count}
        isDeleting={deletePage.isPending}
        onConfirm={() => deletePage.mutate(page.id)}
      />
    </div>
  );
}
