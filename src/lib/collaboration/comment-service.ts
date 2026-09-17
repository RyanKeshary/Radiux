import { 
  InlineCommentThread, 
  InlineComment, 
  CommentAuthor, 
  ReviewRequest, 
  ReviewStatus,
  PullRequestComment,
  PullRequestTimelineEvent 
} from './types';
import { config } from '@/lib/config';

const STORAGE_PREFIX_COMMENTS = 'radiux_inline_comments_';
const STORAGE_PREFIX_REVIEWS = 'radiux_review_requests_';

export class CommentService {
  private static getStored<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  }

  private static setStored<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('[CommentService] Storage error:', e);
    }
  }

  // --- Backend Real-time HTTP Synchronization ---

  private static getApiBase(): string {
    return config.apiUrl;
  }

  private static async syncCommentsToServer(projectId: string, threads: InlineCommentThread[]): Promise<void> {
    try {
      const url = `${this.getApiBase()}/api/comments`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, threads }),
      });
    } catch (e) {
      console.warn('[CommentService] Server sync comments failed, local cache maintained:', e);
    }
  }

  private static async syncReviewsToServer(
    projectId: string, 
    reviews: ReviewRequest[], 
    notification?: any
  ): Promise<void> {
    try {
      const url = `${this.getApiBase()}/api/reviews`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, reviews, notification }),
      });
    } catch (e) {
      console.warn('[CommentService] Server sync reviews failed, local cache maintained:', e);
    }
  }

  static async fetchThreadsFromServer(projectId: string): Promise<InlineCommentThread[]> {
    try {
      const url = `${this.getApiBase()}/api/comments?projectId=${encodeURIComponent(projectId)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.threads)) {
          this.setStored(`${STORAGE_PREFIX_COMMENTS}${projectId}`, data.threads);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('radiux:comments-updated', { detail: { projectId } }));
          }
          return data.threads;
        }
      }
    } catch (e) {
      // Fall back to local
    }
    return this.getStored<InlineCommentThread[]>(`${STORAGE_PREFIX_COMMENTS}${projectId}`, []);
  }

  static async fetchReviewsFromServer(projectId: string): Promise<ReviewRequest[]> {
    try {
      const url = `${this.getApiBase()}/api/reviews?projectId=${encodeURIComponent(projectId)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reviews)) {
          this.setStored(`${STORAGE_PREFIX_REVIEWS}${projectId}`, data.reviews);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('radiux:reviews-updated', { detail: { projectId } }));
          }
          return data.reviews;
        }
      }
    } catch (e) {
      // Fall back to local
    }
    return this.getStored<ReviewRequest[]>(`${STORAGE_PREFIX_REVIEWS}${projectId}`, []);
  }

  // Handle incoming WebSocket broadcast
  static handleRemoteCommentsUpdate(projectId: string, threads: InlineCommentThread[]): void {
    if (!Array.isArray(threads)) return;
    this.setStored(`${STORAGE_PREFIX_COMMENTS}${projectId}`, threads);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:comments-updated', { detail: { projectId } }));
    }
  }

  static handleRemoteReviewsUpdate(projectId: string, reviews: ReviewRequest[]): void {
    if (!Array.isArray(reviews)) return;
    this.setStored(`${STORAGE_PREFIX_REVIEWS}${projectId}`, reviews);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:reviews-updated', { detail: { projectId } }));
    }
  }

  // --- Inline Threads ---

  static getThreads(projectId: string, filePath?: string): InlineCommentThread[] {
    const all = this.getStored<InlineCommentThread[]>(`${STORAGE_PREFIX_COMMENTS}${projectId}`, []);
    // Trigger background fetch if browser is active
    if (typeof window !== 'undefined') {
      this.fetchThreadsFromServer(projectId).catch(() => {});
    }
    if (filePath) {
      return all.filter((t) => t.filePath === filePath);
    }
    return all;
  }

  static createThread(
    projectId: string,
    filePath: string,
    line: number,
    content: string,
    author: CommentAuthor
  ): InlineCommentThread {
    const all = this.getStored<InlineCommentThread[]>(`${STORAGE_PREFIX_COMMENTS}${projectId}`, []);
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const newComment: InlineComment = {
      id: commentId,
      threadId,
      author,
      content,
      createdAt: new Date().toISOString(),
    };

    const newThread: InlineCommentThread = {
      id: threadId,
      projectId,
      filePath,
      startLine: line,
      status: 'open',
      createdAt: new Date().toISOString(),
      comments: [newComment],
    };

    all.push(newThread);
    this.setStored(`${STORAGE_PREFIX_COMMENTS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:comments-updated', { detail: { projectId } }));
    }
    this.syncCommentsToServer(projectId, all);
    return newThread;
  }

  static addReply(
    projectId: string,
    threadId: string,
    content: string,
    author: CommentAuthor
  ): InlineComment | null {
    const all = this.getStored<InlineCommentThread[]>(`${STORAGE_PREFIX_COMMENTS}${projectId}`, []);
    const thread = all.find((t) => t.id === threadId);
    if (!thread) return null;

    const newComment: InlineComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      threadId,
      author,
      content,
      createdAt: new Date().toISOString(),
    };

    thread.comments.push(newComment);
    this.setStored(`${STORAGE_PREFIX_COMMENTS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:comments-updated', { detail: { projectId } }));
    }
    this.syncCommentsToServer(projectId, all);
    return newComment;
  }

  static resolveThread(projectId: string, threadId: string, resolvedBy: CommentAuthor): boolean {
    const all = this.getStored<InlineCommentThread[]>(`${STORAGE_PREFIX_COMMENTS}${projectId}`, []);
    const thread = all.find((t) => t.id === threadId);
    if (!thread) return false;

    thread.status = 'resolved';
    thread.resolvedBy = resolvedBy;
    thread.resolvedAt = new Date().toISOString();

    this.setStored(`${STORAGE_PREFIX_COMMENTS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:comments-updated', { detail: { projectId } }));
    }
    this.syncCommentsToServer(projectId, all);
    return true;
  }

  static reopenThread(projectId: string, threadId: string): boolean {
    const all = this.getStored<InlineCommentThread[]>(`${STORAGE_PREFIX_COMMENTS}${projectId}`, []);
    const thread = all.find((t) => t.id === threadId);
    if (!thread) return false;

    thread.status = 'open';
    thread.resolvedBy = undefined;
    thread.resolvedAt = undefined;

    this.setStored(`${STORAGE_PREFIX_COMMENTS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:comments-updated', { detail: { projectId } }));
    }
    this.syncCommentsToServer(projectId, all);
    return true;
  }

  static deleteComment(projectId: string, threadId: string, commentId: string, userId: string): boolean {
    const all = this.getStored<InlineCommentThread[]>(`${STORAGE_PREFIX_COMMENTS}${projectId}`, []);
    const threadIndex = all.findIndex((t) => t.id === threadId);
    if (threadIndex === -1) return false;

    const thread = all[threadIndex];
    const targetComment = thread.comments.find((c) => c.id === commentId);
    if (!targetComment) return false;
    if (targetComment.author.id !== userId && thread.comments[0]?.author.id !== userId) {
      return false; // Unauthorized
    }

    thread.comments = thread.comments.filter((c) => c.id !== commentId);

    if (thread.comments.length === 0) {
      all.splice(threadIndex, 1);
    }

    this.setStored(`${STORAGE_PREFIX_COMMENTS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:comments-updated', { detail: { projectId } }));
    }
    this.syncCommentsToServer(projectId, all);
    return true;
  }

  // --- Review Requests (Pull Requests) ---

  static getReviewRequests(projectId: string): ReviewRequest[] {
    const all = this.getStored<ReviewRequest[]>(`${STORAGE_PREFIX_REVIEWS}${projectId}`, []);
    if (typeof window !== 'undefined') {
      this.fetchReviewsFromServer(projectId).catch(() => {});
    }
    return all;
  }

  static createReviewRequest(
    projectId: string,
    title: string,
    description: string,
    branch: string,
    requester: CommentAuthor,
    reviewer: CommentAuthor,
    baseBranch: string = 'main'
  ): ReviewRequest {
    const all = this.getStored<ReviewRequest[]>(`${STORAGE_PREFIX_REVIEWS}${projectId}`, []);
    const prNumber = all.length + 1;
    const now = new Date().toISOString();

    const initialTimeline: PullRequestTimelineEvent[] = [
      {
        id: `tl-${Date.now()}-1`,
        type: 'opened',
        author: requester,
        content: description,
        createdAt: now,
      }
    ];

    const newReq: ReviewRequest = {
      id: `pr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      number: prNumber,
      projectId,
      title,
      description,
      branch: branch || 'feature',
      baseBranch,
      requester,
      reviewer,
      status: 'open',
      createdAt: now,
      timeline: initialTimeline,
      comments: [],
    };

    all.unshift(newReq);
    this.setStored(`${STORAGE_PREFIX_REVIEWS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:reviews-updated', { detail: { projectId } }));
    }

    // Create notification for the assigned reviewer
    const notif = reviewer.id ? {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      user_id: reviewer.id,
      type: 'review_requested',
      title: 'Review Requested',
      message: `${requester.name} requested your review on: "${title}"`,
      sender_id: requester.id,
      sender_name: requester.name,
      sender_avatar: requester.avatar || '',
      read: false,
      created_at: now,
      data: { projectId, reviewId: newReq.id },
    } : undefined;

    this.syncReviewsToServer(projectId, all, notif);
    return newReq;
  }

  static addReviewComment(
    projectId: string,
    requestId: string,
    content: string,
    author: CommentAuthor
  ): PullRequestComment | null {
    const all = this.getStored<ReviewRequest[]>(`${STORAGE_PREFIX_REVIEWS}${projectId}`, []);
    const req = all.find((r) => r.id === requestId);
    if (!req) return null;

    const now = new Date().toISOString();
    const newComment: PullRequestComment = {
      id: `prc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      author,
      content,
      createdAt: now,
    };

    if (!req.comments) req.comments = [];
    req.comments.push(newComment);

    if (!req.timeline) req.timeline = [];
    req.timeline.push({
      id: `tl-${Date.now()}`,
      type: 'comment',
      author,
      content,
      createdAt: now,
    });

    req.updatedAt = now;
    this.setStored(`${STORAGE_PREFIX_REVIEWS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:reviews-updated', { detail: { projectId } }));
    }

    // Notify the other party
    const targetUserId = author.id === req.requester.id ? req.reviewer.id : req.requester.id;
    const notif = targetUserId ? {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      user_id: targetUserId,
      type: 'pr_comment',
      title: 'New Comment on Pull Request',
      message: `${author.name} commented on "${req.title}"`,
      sender_id: author.id,
      sender_name: author.name,
      sender_avatar: author.avatar || '',
      read: false,
      created_at: now,
      data: { projectId, reviewId: req.id },
    } : undefined;

    this.syncReviewsToServer(projectId, all, notif);
    return newComment;
  }

  static updateReviewStatus(
    projectId: string,
    requestId: string,
    status: ReviewStatus,
    notes?: string,
    actor?: CommentAuthor
  ): boolean {
    const all = this.getStored<ReviewRequest[]>(`${STORAGE_PREFIX_REVIEWS}${projectId}`, []);
    const req = all.find((r) => r.id === requestId);
    if (!req) return false;

    const now = new Date().toISOString();
    req.status = status;
    req.updatedAt = now;
    if (notes) req.reviewNotes = notes;

    if (!req.timeline) req.timeline = [];
    const timelineType = (status === 'approved' || status === 'changes_requested' || status === 'merged' || status === 'closed') 
      ? status 
      : 'comment';

    if (actor) {
      req.timeline.push({
        id: `tl-${Date.now()}`,
        type: timelineType,
        author: actor,
        content: notes || (status === 'merged' ? 'Merged branch into main' : undefined),
        createdAt: now,
      });
    }

    this.setStored(`${STORAGE_PREFIX_REVIEWS}${projectId}`, all);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('radiux:reviews-updated', { detail: { projectId } }));
    }

    // Notify the author/reviewer
    const notifyUser = actor && actor.id === req.reviewer.id ? req.requester : req.reviewer;
    let notifTitle = 'Pull Request Updated';
    if (status === 'approved') notifTitle = 'Pull Request Approved!';
    else if (status === 'changes_requested') notifTitle = 'Changes Requested on Pull Request';
    else if (status === 'merged') notifTitle = 'Pull Request Merged!';

    const notif = (notifyUser && notifyUser.id && actor) ? {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      user_id: notifyUser.id,
      type: 'review_status',
      title: notifTitle,
      message: `${actor.name} ${status.replace('_', ' ')} "${req.title}"`,
      sender_id: actor.id,
      sender_name: actor.name,
      sender_avatar: actor.avatar || '',
      read: false,
      created_at: now,
      data: { projectId, reviewId: req.id },
    } : undefined;

    this.syncReviewsToServer(projectId, all, notif);
    return true;
  }
}
