import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import { Check, ChevronDown, FolderKanban, Plus } from "lucide-react";

import type { Workspace } from "@/features/workspaces/types/workspace.types";

interface WorkspaceSelectDropdownProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isSelecting?: boolean;
  isLoading?: boolean;
  onSelectWorkspace: (workspaceId: string) => Promise<void>;
  onOpenCreate: () => void;
}

export function WorkspaceSelectDropdown({
  workspaces,
  activeWorkspace,
  isSelecting = false,
  isLoading = false,
  onSelectWorkspace,
  onOpenCreate,
}: WorkspaceSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const hasWorkspaces = workspaces.length > 0;

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="flat"
        className="h-12 w-full justify-between rounded-xl border border-zinc-200 bg-gradient-to-r from-zinc-100 to-zinc-50 px-3 text-zinc-800 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800 dark:text-zinc-100"
        endContent={<ChevronDown className="h-4 w-4 text-zinc-500" />}
        isLoading={isSelecting || isLoading}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg bg-brand-100 p-1.5 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            <FolderKanban className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold">
              {activeWorkspace?.name ?? (isLoading ? "Cargando workspaces..." : "Selecciona workspace")}
            </p>
            <p className="truncate text-xs text-zinc-500">{activeWorkspace?.role ?? "Sin selección"}</p>
          </div>
        </div>
      </Button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] rounded-xl border border-zinc-200 bg-white p-2 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="space-y-1">
            {hasWorkspaces ? (
              workspaces.map((workspace) => {
                const isActive = activeWorkspace?.id === workspace.id;

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      void onSelectWorkspace(workspace.id);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {workspace.name}
                      </span>
                      <span className="block text-xs capitalize text-zinc-500">{workspace.role}</span>
                    </span>
                    {isActive ? <Check className="h-4 w-4 text-brand-600" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-xs text-zinc-500">Aún no tienes workspaces.</p>
            )}
          </div>

          <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <Button
              type="button"
              variant="light"
              className="w-full justify-start text-brand-700 dark:text-brand-300"
              startContent={<Plus className="h-4 w-4" />}
              onPress={() => {
                onOpenCreate();
                setIsOpen(false);
              }}
            >
              Crear workspace
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
