import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Command, CommandList } from "@/components/ui/shadcn/command";
import { CommandPaletteProjects } from "@/features/command-palette/components/CommandPaletteProjects";
import type { Project } from "@/features/projects/types/project.types";

// jsdom no implementa `Element.scrollIntoView` (ver el mismo guard en
// CommandPaletteTickets.test.tsx).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

const PROJECTS: Project[] = [
  {
    id: "project-1",
    workspace_id: "workspace-1",
    name: "Core Platform",
    key: "TASK",
    description: null,
    color: "#2563EB",
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    columns: [],
  },
  {
    id: "project-2",
    workspace_id: "workspace-1",
    name: "Growth",
    key: "GRW",
    description: null,
    color: "#DC2626",
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    columns: [],
  },
];

function renderInCommand(ui: React.ReactElement) {
  return render(
    <Command shouldFilter={false}>
      <CommandList>{ui}</CommandList>
    </Command>,
  );
}

describe("CommandPaletteProjects", () => {
  it("filters projects locally by the typed query", () => {
    renderInCommand(
      <CommandPaletteProjects
        projects={PROJECTS}
        workspaceSlug="producto"
        query="growth"
        onNavigate={vi.fn()}
        closePalette={vi.fn()}
      />,
    );

    expect(screen.getByText("Growth")).toBeInTheDocument();
    expect(screen.queryByText("Core Platform")).not.toBeInTheDocument();
  });

  it("navigates to the project board on select", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const closePalette = vi.fn();

    renderInCommand(
      <CommandPaletteProjects
        projects={PROJECTS}
        workspaceSlug="producto"
        query=""
        onNavigate={onNavigate}
        closePalette={closePalette}
      />,
    );

    await user.click(screen.getByText("Core Platform"));

    expect(closePalette).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/workspaces/producto/projects/project-1/board");
  });
});
