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
        className={`${sizeClass} rounded-full object-cover ring-1 ring-white dark:ring-zinc-900`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 font-semibold text-white ring-1 ring-white dark:ring-zinc-900`}
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

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.user_id)),
    [members, selectedIds],
  );

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
          className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-0.5 pr-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <MemberAvatar member={member} size="xs" />
          <span className="max-w-[80px] truncate font-medium">
            {member.full_name.split(" ")[0]}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={(e) => removeAssignee(member.user_id, e)}
              className="ml-0.5 rounded-full p-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              aria-label={`Quitar a ${member.full_name}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
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
              className="h-7 gap-1.5 rounded-full border border-dashed border-zinc-300 px-2.5 py-0 text-xs text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
                <CommandEmpty className="py-4 text-center text-xs text-zinc-500">
                  No se encontraron miembros.
                </CommandEmpty>
                <CommandGroup className="pb-1">
                  {members.map((member) => {
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
                          <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                            {member.full_name}
                          </span>
                          <span className="truncate text-[10px] text-zinc-400">
                            {member.email}
                          </span>
                        </div>
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-violet-600 bg-violet-600"
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>

                {selectedMembers.length > 0 && (
                  <div className="border-t border-zinc-100 px-2.5 py-2 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => onChange([])}
                      className="w-full rounded px-2 py-1 text-left text-[11px] text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Sin asignar</span>
      )}
    </div>
  );
}
