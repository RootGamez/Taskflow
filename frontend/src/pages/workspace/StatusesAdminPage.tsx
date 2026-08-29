import { useState } from "react";
import { Button } from "@heroui/react";
import { Lock, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/shadcn/badge";
import { Input } from "@/components/ui/shadcn/input";
import { useStatusMutations, useWorkspaceStatuses } from "@/features/board/hooks/useWorkspaceStatuses";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function StatusesAdminPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);

  const { data: statuses = [] } = useWorkspaceStatuses(workspaceSlug);
  const { create, update, remove } = useStatusMutations(workspaceSlug);

  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await create.mutateAsync({ name: newName.trim() });
      setNewName("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el estado"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espacio"
        title="Estados del espacio"
        subtitle="Las columnas del tablero. Cada proyecto adopta automáticamente una columna por estado."
        actions={
          <Button variant="light" className="rounded-none" onPress={() => navigate(`/workspaces/${workspaceSlug}`)}>
            Ver tablero
          </Button>
        }
      />

      <p className="border-2 border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Backlog</strong>,{" "}
        <strong className="text-foreground">En progreso</strong> y{" "}
        <strong className="text-foreground">Completado</strong> son fijos y no se pueden editar ni
        eliminar. Podés agregar estados extra debajo.
      </p>

      <ul className="divide-y-2 divide-border border-2 border-border">
        {statuses.map((statusItem) => (
          <li key={statusItem.id} className="flex flex-wrap items-center gap-3 bg-card p-3">
            <span
              className="boxed-icon h-5 w-5 shrink-0"
              style={{ backgroundColor: statusItem.color }}
              aria-hidden
            />

            {statusItem.is_system ? (
              <>
                <span className="font-medium text-foreground">{statusItem.name}</span>
                {statusItem.is_done ? (
                  <Badge variant="success" mono>
                    Completado
                  </Badge>
                ) : null}
                <Lock className="ml-auto h-4 w-4 text-muted-foreground" />
              </>
            ) : (
              <>
                <Input
                  className="h-9 max-w-xs"
                  defaultValue={statusItem.name}
                  disabled={!canMutate}
                  onBlur={(event) => {
                    const value = event.currentTarget.value.trim();
                    if (value && value !== statusItem.name) {
                      update.mutate({ statusId: statusItem.id, payload: { name: value } });
                    }
                  }}
                />
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={statusItem.is_done}
                    disabled={!canMutate}
                    onChange={(event) =>
                      update.mutate({
                        statusId: statusItem.id,
                        payload: { is_done: event.target.checked },
                      })
                    }
                  />
                  Cuenta como completado
                </label>
                {canMutate ? (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="ml-auto rounded-none"
                    aria-label={`Eliminar ${statusItem.name}`}
                    onPress={() => remove.mutate(statusItem.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      {canMutate ? (
        <div className="flex gap-2">
          <Input
            className="h-9 max-w-xs"
            placeholder="Nuevo estado (ej. En revisión)"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <Button size="sm" color="primary" className="rounded-none" onPress={handleCreate} isLoading={create.isPending}>
            Agregar estado
          </Button>
        </div>
      ) : null}
    </div>
  );
}
