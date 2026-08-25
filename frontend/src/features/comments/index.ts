export { CommentThread } from "@/features/comments/components/CommentThread";
export type { CommentGroup, CommentThreadProps } from "@/features/comments/components/CommentThread";
export { CommentItem } from "@/features/comments/components/CommentItem";
export { CommentComposer } from "@/features/comments/components/CommentComposer";
export { commentQueryKeys } from "@/features/comments/lib/commentQueryKeys";
export {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "@/features/comments/hooks/useComments";
export { handleCommentSocketMessage } from "@/features/comments/hooks/useCommentsRealtime";
export type { CommentSocketMessage } from "@/features/comments/hooks/useCommentsRealtime";
export { splitBodyByMentions } from "@/features/comments/utils/parseMentions";
export type { BodySegment, MentionEntry } from "@/features/comments/utils/parseMentions";
export * from "@/features/comments/api/commentsApi";
export type {
  Comment,
  CommentAuthor,
  CommentMention,
  CreateCommentPayload,
  UpdateCommentPayload,
} from "@/features/comments/types/comment.types";
