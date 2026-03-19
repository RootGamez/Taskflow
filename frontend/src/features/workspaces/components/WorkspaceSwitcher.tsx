import { Select, SelectItem } from "@heroui/react";
import { useNavigate } from "react-router-dom";

import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { data: workspaces = [] } = useWorkspaces();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);

  return (
    <Select
      aria-label="Seleccionar workspace"
      selectedKeys={activeWorkspace ? [activeWorkspace.id] : []}
      onSelectionChange={(keys) => {
        const first = Array.from(keys)[0];
        const selected = workspaces.find((workspace) => workspace.id === first);
        if (selected) {
          setActiveWorkspace(selected);
          navigate(`/workspaces/${selected.slug}`);
        }
      }}
      placeholder="Selecciona workspace"
      variant="bordered"
      className="max-w-full"
    >
      {workspaces.map((workspace) => (
        <SelectItem key={workspace.id}>
          {workspace.name}
        </SelectItem>
      ))}
    </Select>
  );
}
