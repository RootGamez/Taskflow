export interface CommentAuthor {
  id: string;
  full_name: string;
  email: string;
}

export interface CommentMention {
  id: string;
  full_name: string;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author: CommentAuthor | null;
  body: string;
  mentions: CommentMention[];
  created_at: string;
  edited_at: string | null;
}

export interface CreateCommentPayload {
  body: string;
  mention_user_ids: string[];
}

export interface UpdateCommentPayload {
  body: string;
  mention_user_ids: string[];
}
