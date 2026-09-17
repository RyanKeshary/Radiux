export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface InlineComment {
  id: string;
  threadId: string;
  author: CommentAuthor;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InlineCommentThread {
  id: string;
  projectId: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  status: 'open' | 'resolved';
  resolvedBy?: CommentAuthor;
  resolvedAt?: string;
  createdAt: string;
  comments: InlineComment[];
}

export type ReviewStatus = 'open' | 'pending' | 'approved' | 'changes_requested' | 'merged' | 'closed' | 'completed';

export interface PullRequestComment {
  id: string;
  author: CommentAuthor;
  content: string;
  createdAt: string;
}

export interface PullRequestTimelineEvent {
  id: string;
  type: 'opened' | 'comment' | 'approved' | 'changes_requested' | 'merged' | 'closed';
  author: CommentAuthor;
  content?: string;
  createdAt: string;
}

export interface ReviewRequest {
  id: string;
  number?: number;
  projectId: string;
  title: string;
  description?: string;
  branch: string;
  baseBranch?: string;
  requester: CommentAuthor;
  reviewer: CommentAuthor;
  status: ReviewStatus;
  createdAt: string;
  updatedAt?: string;
  reviewNotes?: string;
  timeline?: PullRequestTimelineEvent[];
  comments?: PullRequestComment[];
}
