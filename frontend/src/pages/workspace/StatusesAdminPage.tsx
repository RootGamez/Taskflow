import { useState } from "react";
import { Button, Input } from "@heroui/react";
import { Lock, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/ui/PageHeader";
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
        title="Estados del espacio"
        subtitle="Las columnas del tablero. Cada proyecto adopta automáticamente una columna por estado."
        actions={
          <Button variant="light" onPress={() => navigate(`/workspaces/${workspaceSlug}`)}>
            Ver tablero
          </Button>
        }
      />

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <strong>Backlog</strong>, <strong>En progreso</strong> y <strong>Completado</strong> son
        fijos y no se pueden editar ni eliminar. Podés agregar estados extra debajo.
      </p>

      <ul className="space-y-2">
        {statuses.map((statusItem) => (
          <li
            key={statusItem.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: statusItem.color }} />

            {statusItem.is_system ? (
              <>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{statusItem.name}</span>
                {statusItem.is_done ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Completado
                  </span>
                ) : null}
                <Lock className="ml-auto h-4 w-4 text-zinc-300 dark:text-zinc-600" />
              </>
            ) : (
              <>
                <Input
                  size="sm"
                  className="max-w-xs"
                  defaultValue={statusItem.name}
                  isDisabled={!canMutate}
                  onBlur={(event) => {
                    const value = event.currentTarget.value.trim();
                    if (value && value !== statusItem.name) {
                      update.mutate({ statusId: statusItem.id, payload: { name: value } });
                    }
                  }}
                />
                <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
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
                    className="ml-auto"
                    aria-label={`Eliminar ${statusItem.name}`}
                    onPress={() => remove.mutate(statusItem.id)}
                  >
                    <Trash2 className="h-4 w-4 text-zinc-400" />
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
            size="sm"
            className="max-w-xs"
            placeholder="Nuevo estado (ej. En revisión)"
            value={newName}
            onValueChange={setNewName}
          />
          <Button size="sm" color="primary" onPress={handleCreate} isLoading={create.isPending}>
            Agregar estado
          </Button>
        </div>
      ) : null}
    </div>
  );
}
