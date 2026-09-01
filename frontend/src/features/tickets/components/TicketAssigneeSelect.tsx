import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, UserCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/shadcn/command";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getWorkspaceMembers } from "@/features/members/api/membersApi";
import type { WorkspaceMember } from "@/features/members/types/member.types";

interface TicketAssigneeSelectProps {
  /** IDs of the User objects (ticket.assignees[].id) */
  assigneeIds: string[];
  onChange: (assigneeIds: string[]) => void;
  disabled?: boolean;
}

function MemberAvatar({
  member,
  size = "sm",
}: {
  member: WorkspaceMember;
  size?: "xs" | "sm" | "md";
}) {
  const sizeClass = {
    xs: "h-4 w-4 text-[9px]",
    sm: "h-5 w-5 text-[10px]",
    md: "h-7 w-7 text-xs",
  }[size];
  // Ex-miembro (soft-delete, role="removed"): sigue teniendo tareas
  // asignadas aca (no se le quitan al eliminarlo del espacio), pero se
  // desatura para distinguirlo de un responsable activo a simple vista.
  const isRemoved = member.role === "removed";
  const removedClass = isRemoved ? "grayscale opacity-60" : "";

  const initials = member.full_name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.full_name}
        className={`${sizeClass} ${removedClass} rounded-full object-cover ring-1 ring-card`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${removedClass} flex items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground ring-1 ring-card`}
    >
      {initials}
    </div>
  );
}

export function TicketAssigneeSelect({
  assigneeIds,
  onChange,
  disabled,
}: TicketAssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["workspace", activeWorkspace?.slug, "members"],
    queryFn: () => getWorkspaceMembers(activeWorkspace!.slug),
    enabled: !!activeWorkspace?.slug,
    staleTime: 5 * 60 * 1000, // 5 min — members list does not change often
  });

  // assigneeIds are User IDs (ticket.assignees[].id) — match against member.user_id
  const selectedIds = useMemo(() => new Set(assigneeIds), [assigneeIds]);

  // El picker de "asignar" solo ofrece miembros activos -- alguien
  // expulsado del espacio (role="removed") no deberia poder recibir
  // tareas nuevas. Pero si ya estaba asignado, se lo sigue mostrando (mas
  // abajo) para no dejar el ticket huerfano ni perder de vista quien era.
  const assignableMembers = useMemo(
    () => members.filter((m) => m.role !== "removed"),
    [members],
  );

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.user_id)),
    [members, selectedIds],
  );

  // "Quitar todos" solo debe tocar a los responsables activos -- a un
  // ex-miembro no se lo puede volver a desasignar desde aca (ver el chip
  // mas abajo), asi que tampoco se lo lleva puesto un "quitar todos".
  const removedSelectedIds = useMemo(
    () =>
      new Set(
        selectedMembers.filter((m) => m.role === "removed").map((m) => m.user_id),
      ),
    [selectedMembers],
  );
  const hasActiveSelectedMembers = selectedMembers.some((m) => m.role !== "removed");

  const toggleAssignee = (userId: string) => {
    const next = new Set(selectedIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    onChange(Array.from(next));
  };

  const removeAssignee = (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(assigneeIds.filter((id) => id !== userId));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Selected member chips */}
      {selectedMembers.map((member) => (
        <div
          key={member.user_id}
          title={member.role === "removed" ? `${member.full_name} ya no pertenece al espacio` : undefined}
          className={`flex items-center gap-1 rounded-full border-[1.5px] py-0.5 pl-0.5 pr-1.5 text-xs ${
            member.role === "removed"
              ? "border-dashed border-border bg-muted/50 text-muted-foreground"
              : "border-border bg-muted text-foreground"
          }`}
        >
          <MemberAvatar member={member} size="xs" />
          <span className="max-w-[80px] truncate font-medium">
            {member.full_name.split(" ")[0]}
          </span>
          {member.role === "removed" ? (
            <span className="rounded-full bg-secondary px-1 py-px text-[9px] uppercase tracking-wide text-secondary-foreground">
              Ex
            </span>
          ) : (
            // A un ex-miembro no se lo puede volver a tocar desde aca: ni
            // reasignar (ya esta fuera de `assignableMembers`) ni quitar --
            // ver nota en member.types.ts / WorkspaceMemberDetailView.delete
            // sobre por que se conserva la asignacion en vez de limpiarla.
            !disabled && (
              <button
                type="button"
                onClick={(e) => removeAssignee(member.user_id, e)}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`Quitar a ${member.full_name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )
          )}
        </div>
      ))}

      {/* Add assignee popover trigger */}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isLoading}
              className="h-7 gap-1.5 rounded-full border-[1.5px] border-dashed border-border px-2.5 py-0 text-xs text-muted-foreground hover:border-foreground hover:bg-accent hover:text-foreground"
            >
              {selectedMembers.length === 0 ? (
                <>
                  <UserCircle2 className="h-3.5 w-3.5" />
                  <span>Asignar</span>
                </>
              ) : (
                <>
                  <span>+</span>
                  <ChevronDown className="h-3 w-3" />
                </>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent
            data-ticket-editor-floating="true"
            className="w-60 p-0"
            align="start"
            sideOffset={4}
          >
            <Command>
              <CommandInput
                placeholder="Buscar miembro..."
                className="h-9 text-xs"
              />
              <CommandList>
                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                  No se encontraron miembros.
                </CommandEmpty>
                <CommandGroup className="pb-1">
                  {assignableMembers.map((member) => {
                    const isSelected = selectedIds.has(member.user_id);
                    return (
                      <CommandItem
                        key={member.user_id}
                        value={`${member.full_name} ${member.email}`}
                        onSelect={() => {
                          toggleAssignee(member.user_id);
                          // Close only when deselecting the last or first assignment
                          // to allow multi-select without reopening
                        }}
                        className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-xs"
                      >
                        <MemberAvatar member={member} size="sm" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {member.full_name}
                          </span>
                          <span className="truncate text-[10px] text-muted-foreground">
                            {member.email}
                          </span>
                        </div>
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors ${
                            isSelected ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>

                {hasActiveSelectedMembers && (
                  <div className="border-t-2 border-border px-2.5 py-2">
                    <button
                      type="button"
                      onClick={() => onChange(assigneeIds.filter((id) => removedSelectedIds.has(id)))}
                      className="w-full rounded px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Quitar todos los responsables
                    </button>
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Read-only state when disabled and no assignees */}
      {disabled && selectedMembers.length === 0 && (
        <span className="text-xs text-muted-foreground">Sin asignar</span>
      )}
    </div>
  );
}
