import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/shadcn/command";
import { useCreateComment } from "@/features/comments/hooks/useComments";
import { getWorkspaceMembers } from "@/features/members/api/membersApi";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { WorkspaceMember } from "@/features/members/types/member.types";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface CommentComposerProps {
  projectId: string;
  ticketId: string;
}

const MAX_COMMENT_LENGTH = 5000;
// Nombre de mención: letras/números/espacio, cortado apenas aparece otro "@"
// o un salto de línea — suficientemente simple para el caso de uso (sin
// soportar acentos vía \w explícitamente, se cubre con el rango unicode).
const MENTION_TRIGGER_PATTERN = /@([^\s@]*)$/u;

function memberToAvatarUser(member: WorkspaceMember) {
  return {
    id: member.user_id,
    full_name: member.full_name,
    avatar_url: member.avatar_url,
    email: member.email,
    is_active: member.is_active,
    created_at: member.created_at,
  };
}

export function CommentComposer({ projectId, ticketId }: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentUser = useAuthStore((state) => state.user);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const createComment = useCreateComment(projectId, ticketId);

  const { data: members = [] } = useQuery({
    queryKey: ["workspace", activeWorkspace?.slug, "members"],
    queryFn: () => getWorkspaceMembers(activeWorkspace!.slug),
    enabled: isMentionOpen && Boolean(activeWorkspace?.slug),
    staleTime: 5 * 60 * 1000, // 5 min — misma cache que TicketAssigneeSelect
  });

  const filteredMembers = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) {
      return members;
    }
    return members.filter((member) => member.full_name.toLowerCase().includes(query));
  }, [members, mentionQuery]);

  const resizeTextarea = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  const resetComposer = () => {
    setBody("");
    setMentionedUsers(new Map());
    setIsMentionOpen(false);
    setMentionQuery("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const submitComment = () => {
    const trimmed = body.trim();
    if (!trimmed || createComment.isPending) {
      return;
    }

    const mentionUserIds = Array.from(mentionedUsers.entries())
      .filter(([, fullName]) => body.includes(`@${fullName}`))
      .map(([userId]) => userId);

    createComment.mutate({ body, mention_user_ids: mentionUserIds }, { onSuccess: resetComposer });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitComment();
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setBody(value);
    resizeTextarea(event.target);

    const cursor = event.target.selectionStart ?? value.length;
    const match = MENTION_TRIGGER_PATTERN.exec(value.slice(0, cursor));

    if (match) {
      setIsMentionOpen(true);
      setMentionQuery(match[1]);
    } else {
      setIsMentionOpen(false);
      setMentionQuery("");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && isMentionOpen) {
      setIsMentionOpen(false);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !isMentionOpen) {
      event.preventDefault();
      submitComment();
    }
  };

  const selectMember = (member: WorkspaceMember) => {
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const beforeCursor = body.slice(0, cursor);
    const afterCursor = body.slice(cursor);
    const replacedBefore = beforeCursor.replace(MENTION_TRIGGER_PATTERN, `@${member.full_name} `);
    const nextBody = `${replacedBefore}${afterCursor}`;

    setBody(nextBody);
    setMentionedUsers((previous) => new Map(previous).set(member.user_id, member.full_name));
    setIsMentionOpen(false);
    setMentionQuery("");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2 border-t-2 border-border pt-3">
      {currentUser ? <MemberAvatar user={currentUser} size="sm" /> : null}

      <div className="relative flex flex-1 flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_COMMENT_LENGTH}
          rows={1}
          placeholder="Escribí un comentario… (Enter para enviar)"
          aria-label="Escribir comentario"
          className="min-h-[36px] w-full resize-none rounded border-2 border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {isMentionOpen ? (
          <div
            role="listbox"
            aria-label="Mencionar a un miembro"
            className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded border-2 border-border bg-popover shadow-hard dark:shadow-hard-float"
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
                  Sin coincidencias.
                </CommandEmpty>
                <CommandGroup>
                  {filteredMembers.map((member) => (
                    <CommandItem
                      key={member.user_id}
                      value={member.user_id}
                      onSelect={() => selectMember(member)}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <MemberAvatar user={memberToAvatarUser(member)} size="sm" />
                      <span className="truncate text-sm">{member.full_name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || createComment.isPending}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Enviar
          </Button>
        </div>
      </div>
    </form>
  );
}
