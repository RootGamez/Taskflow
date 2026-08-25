import { useState } from "react";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Textarea } from "@/components/ui/shadcn/textarea";
import { Button as ShadcnButton } from "@/components/ui/shadcn/button";
import { useDeleteComment, useUpdateComment } from "@/features/comments/hooks/useComments";
import type { Comment } from "@/features/comments/types/comment.types";
import { splitBodyByMentions } from "@/features/comments/utils/parseMentions";

interface CommentItemProps {
  comment: Comment;
  showHeader: boolean;
  currentUserId: string | null;
  projectId: string;
  ticketId: string;
}

// Avatar propio (en vez de reusar `MemberAvatar`): el autor de un comentario
// llega del backend como `{id, full_name, email} | null` (D2, sin
// `avatar_url`), un shape más chico que `User` — para no forzar ese campo
// extra en el contrato de la API solo para pintar un avatar acá.
function CommentAuthorAvatar({ author }: { author: Comment["author"] }) {
  const label = author?.full_name ?? "Usuario eliminado";
  const initials =
    label
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {initials}
    </div>
  );
}

function CommentBody({ comment }: { comment: Comment }) {
  const segments = splitBodyByMentions(comment.body, comment.mentions);

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <span
            key={`${segment.userId}-${index}`}
            className="inline-flex rounded-full bg-accent px-1.5 text-accent-foreground"
          >
            {segment.text}
          </span>
        ) : (
          <span key={`text-${index}`}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

export function CommentItem({ comment, showHeader, currentUserId, projectId, ticketId }: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(comment.body);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const updateComment = useUpdateComment(projectId, ticketId);
  const deleteComment = useDeleteComment(projectId, ticketId);

  const isOwnComment = comment.author?.id != null && comment.author.id === currentUserId;
  const timestampLabel = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es });

  const startEditing = () => {
    setDraftBody(comment.body);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftBody(comment.body);
    setIsEditing(false);
  };

  const saveEdit = () => {
    const trimmed = draftBody.trim();
    if (!trimmed || updateComment.isPending) {
      return;
    }

    // Editar es texto plano simple (sin autocompletado nuevo, D1): se
    // conservan las menciones existentes cuyo "@nombre" sigue presente en
    // el texto editado; una mención cuyo texto fue borrado se descarta.
    const mentionUserIds = comment.mentions
      .filter((mention) => draftBody.includes(`@${mention.full_name}`))
      .map((mention) => mention.id);

    updateComment.mutate(
      { commentId: comment.id, payload: { body: draftBody, mention_user_ids: mentionUserIds } },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const confirmDelete = () => {
    deleteComment.mutate(comment.id, { onSuccess: () => setIsDeleteDialogOpen(false) });
  };

  return (
    <div className="group flex items-start gap-2">
      <div className="w-8 shrink-0">{showHeader ? <CommentAuthorAvatar author={comment.author} /> : null}</div>

      <div className="min-w-0 flex-1">
        {showHeader ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5 text-sm">
              <span className="font-medium text-foreground">
                {comment.author?.full_name ?? "Usuario eliminado"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{timestampLabel}</span>
              {comment.edited_at ? (
                <span className="text-xs text-muted-foreground">(editado)</span>
              ) : null}
            </div>

            {isOwnComment ? (
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    aria-label="Opciones del comentario"
                    className="h-6 w-6 min-w-0 opacity-0 transition-opacity focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Opciones del comentario"
                  onAction={(key) => {
                    if (key === "edit") {
                      startEditing();
                    } else if (key === "delete") {
                      setIsDeleteDialogOpen(true);
                    }
                  }}
                >
                  <DropdownItem key="edit">Editar</DropdownItem>
                  <DropdownItem key="delete" color="danger">
                    Eliminar
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : null}
          </div>
        ) : null}

        {isEditing ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              rows={2}
              aria-label="Editar comentario"
            />
            <div className="flex justify-end gap-2">
              <ShadcnButton
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelEditing}
                disabled={updateComment.isPending}
              >
                Cancelar
              </ShadcnButton>
              <ShadcnButton
                type="button"
                size="sm"
                onClick={saveEdit}
                disabled={!draftBody.trim() || updateComment.isPending}
              >
                Guardar
              </ShadcnButton>
            </div>
          </div>
        ) : (
          <CommentBody comment={comment} />
        )}
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Eliminar comentario</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El comentario dejará de verse en la conversación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <ShadcnButton
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteComment.isPending}
            >
              Cancelar
            </ShadcnButton>
            <ShadcnButton
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteComment.isPending}
            >
              {deleteComment.isPending ? "Eliminando..." : "Eliminar"}
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
