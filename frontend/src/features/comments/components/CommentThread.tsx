import { useMemo } from "react";
import { MessageSquare } from "lucide-react";

import { CommentComposer } from "@/features/comments/components/CommentComposer";
import { CommentItem } from "@/features/comments/components/CommentItem";
import { useComments } from "@/features/comments/hooks/useComments";
import type { Comment } from "@/features/comments/types/comment.types";
import { useAuthStore } from "@/store/authStore";

export interface CommentThreadProps {
  ticketId: string;
  projectId: string;
  canComment: boolean;
}

export interface CommentGroup {
  key: string;
  comments: Comment[];
}

// D7.1: comentarios consecutivos del mismo autor a menos de 5 minutos entre
// sí se agrupan (se oculta el avatar/nombre repetido del segundo en
// adelante).
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

export function groupConsecutiveComments(comments: Comment[]): CommentGroup[] {
  const groups: CommentGroup[] = [];

  for (const comment of comments) {
    const lastGroup = groups[groups.length - 1];
    const lastComment = lastGroup?.comments[lastGroup.comments.length - 1];

    const sameAuthor =
      lastComment !== undefined &&
      (lastComment.author?.id ?? null) === (comment.author?.id ?? null);
    const withinWindow =
      lastComment !== undefined &&
      Math.abs(new Date(comment.created_at).getTime() - new Date(lastComment.created_at).getTime()) <=
        GROUPING_WINDOW_MS;

    if (lastGroup && sameAuthor && withinWindow) {
      lastGroup.comments.push(comment);
    } else {
      groups.push({ key: comment.id, comments: [comment] });
    }
  }

  return groups;
}

export function CommentThread({ ticketId, projectId, canComment }: CommentThreadProps) {
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const { data: comments = [], isLoading } = useComments(projectId, ticketId);

  const groups = useMemo(() => groupConsecutiveComments(comments), [comments]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando comentarios…</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="boxed-icon h-10 w-10 text-muted-foreground">
              <MessageSquare className="h-5 w-5" />
            </span>
            <p className="text-sm text-muted-foreground">Sin comentarios todavía</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-1">
              {group.comments.map((comment, index) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  showHeader={index === 0}
                  currentUserId={currentUserId}
                  projectId={projectId}
                  ticketId={ticketId}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {canComment ? <CommentComposer projectId={projectId} ticketId={ticketId} /> : null}
    </div>
  );
}
