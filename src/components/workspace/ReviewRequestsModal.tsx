'use client';

import React, { useState, useEffect } from 'react';
import { ReviewRequest, CommentAuthor, ReviewStatus, PullRequestComment, PullRequestTimelineEvent } from '@/lib/collaboration/types';
import { CommentService } from '@/lib/collaboration/comment-service';
import { 
  GitPullRequest, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  X, 
  Plus, 
  Send, 
  MessageSquare,
  GitBranch,
  Check,
  RotateCcw,
  GitMerge,
  XCircle,
  FileCode2,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

interface ReviewRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentUser: CommentAuthor;
  availableCollaborators?: CommentAuthor[];
  currentBranch?: string;
  onOpenFile?: (filePath: string) => void;
}

export function ReviewRequestsModal({
  isOpen,
  onClose,
  projectId,
  currentUser,
  availableCollaborators = [],
  currentBranch = 'main',
  onOpenFile,
}: ReviewRequestsModalProps) {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Creation form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [branch, setBranch] = useState(currentBranch);
  const [baseBranch, setBaseBranch] = useState('main');
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('');

  // PR Detail state
  const [activePrTab, setActivePrTab] = useState<'conversation' | 'files'>('conversation');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'comment' | 'approve' | 'request_changes'>('approve');
  const [commentText, setCommentText] = useState('');
  
  // List filter
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'merged' | 'closed'>('all');

  const refreshReviews = () => {
    const list = CommentService.getReviewRequests(projectId);
    setRequests(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshReviews();
      CommentService.fetchReviewsFromServer(projectId).then((list) => {
        setRequests(list);
      }).catch(() => {});
    }

    const handleUpdate = () => refreshReviews();
    window.addEventListener('radiux:reviews-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('radiux:reviews-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const selectedPr = requests.find((r) => r.id === selectedPrId) || null;

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Filter available collaborators excluding self
    const validCollaborators = availableCollaborators.filter(c => c.id !== currentUser.id);
    const selectedRev = validCollaborators.find((c) => c.id === selectedReviewerId) || validCollaborators[0] || {
      id: '',
      name: 'Any Reviewer',
    };

    const newPr = CommentService.createReviewRequest(
      projectId,
      title.trim(),
      description.trim(),
      branch || 'feature',
      currentUser,
      selectedRev,
      baseBranch || 'main'
    );

    setIsCreating(false);
    setTitle('');
    setDescription('');
    setSelectedPrId(newPr.id);
    refreshReviews();
  };

  const handleSubmitReview = () => {
    if (!selectedPr) return;

    if (reviewAction === 'comment') {
      if (!reviewNote.trim()) return;
      CommentService.addReviewComment(projectId, selectedPr.id, reviewNote.trim(), currentUser);
    } else if (reviewAction === 'approve') {
      CommentService.updateReviewStatus(
        projectId, 
        selectedPr.id, 
        'approved', 
        reviewNote.trim() || undefined, 
        currentUser
      );
    } else if (reviewAction === 'request_changes') {
      CommentService.updateReviewStatus(
        projectId, 
        selectedPr.id, 
        'changes_requested', 
        reviewNote.trim() || undefined, 
        currentUser
      );
    }

    setReviewNote('');
    refreshReviews();
  };

  const handleMergePr = () => {
    if (!selectedPr) return;
    CommentService.updateReviewStatus(
      projectId, 
      selectedPr.id, 
      'merged', 
      'Merged pull request into ' + (selectedPr.baseBranch || 'main'), 
      currentUser
    );
    refreshReviews();
  };

  const handleClosePr = () => {
    if (!selectedPr) return;
    CommentService.updateReviewStatus(
      projectId, 
      selectedPr.id, 
      'closed', 
      'Closed pull request', 
      currentUser
    );
    refreshReviews();
  };

  const handleReopenPr = () => {
    if (!selectedPr) return;
    CommentService.updateReviewStatus(
      projectId, 
      selectedPr.id, 
      'open', 
      'Reopened pull request', 
      currentUser
    );
    refreshReviews();
  };

  const handleAddDiscussionComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPr || !commentText.trim()) return;

    CommentService.addReviewComment(projectId, selectedPr.id, commentText.trim(), currentUser);
    setCommentText('');
    refreshReviews();
  };

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'open') return r.status === 'open' || r.status === 'pending' || r.status === 'approved' || r.status === 'changes_requested';
    if (activeTab === 'merged') return r.status === 'merged';
    if (activeTab === 'closed') return r.status === 'closed';
    return true;
  });

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'merged':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1.5">
            <GitMerge className="w-3.5 h-3.5" /> Merged
          </span>
        );
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'changes_requested':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Changes Requested
          </span>
        );
      case 'closed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Closed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <GitPullRequest className="w-3.5 h-3.5" /> Open
          </span>
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in select-none p-4"
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'var(--ide-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="w-full max-w-3xl max-h-[88vh] border rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="h-12 px-5 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <div className="flex items-center gap-2.5 font-semibold text-sm">
            <GitPullRequest className="w-5 h-5 text-sky-400" />
            {selectedPr ? (
              <div className="flex items-center gap-2 truncate">
                <button
                  onClick={() => setSelectedPrId(null)}
                  className="hover:text-sky-400 flex items-center gap-1 text-xs text-neutral-400 font-normal"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to PRs
                </button>
                <span className="text-neutral-500">/</span>
                <span className="truncate">#{selectedPr.number || 1} {selectedPr.title}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>Pull Requests</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-neutral-300 font-mono">
                  {requests.length}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!selectedPr && !isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Pull Request</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View 1: Detailed Pull Request View */}
        {selectedPr ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* PR Overview Subheader */}
            <div className="p-5 border-b border-white/10 bg-black/20 space-y-3 flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {selectedPr.title}
                    </h2>
                    <span className="text-neutral-400 font-mono text-xs">#{selectedPr.number || 1}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                    {getStatusBadge(selectedPr.status)}
                    <span className="font-semibold text-neutral-300">{selectedPr.requester.name}</span>
                    <span>wants to merge into</span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-[11px]">
                      {selectedPr.baseBranch || 'main'}
                    </span>
                    <span>from</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-neutral-300 font-mono text-[11px]">
                      {selectedPr.branch}
                    </span>
                  </div>
                </div>

                {/* Merge / Status Action */}
                <div className="flex items-center gap-2">
                  {selectedPr.status !== 'merged' && selectedPr.status !== 'closed' && (
                    <button
                      onClick={handleMergePr}
                      className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-purple-600/20"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Merge Pull Request</span>
                    </button>
                  )}

                  {selectedPr.status !== 'closed' && selectedPr.status !== 'merged' ? (
                    <button
                      onClick={handleClosePr}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium transition-colors"
                    >
                      Close PR
                    </button>
                  ) : selectedPr.status === 'closed' ? (
                    <button
                      onClick={handleReopenPr}
                      className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-medium transition-colors"
                    >
                      Reopen PR
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Subtabs: Conversation vs Files */}
              <div className="flex items-center gap-4 pt-1 border-t border-white/5">
                <button
                  onClick={() => setActivePrTab('conversation')}
                  className={`py-1 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                    activePrTab === 'conversation'
                      ? 'border-sky-400 text-sky-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Conversation</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-neutral-300 font-mono">
                    {(selectedPr.timeline?.length || 1) + (selectedPr.comments?.length || 0)}
                  </span>
                </button>

                <button
                  onClick={() => setActivePrTab('files')}
                  className={`py-1 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                    activePrTab === 'files'
                      ? 'border-sky-400 text-sky-400'
                      : 'border-transparent text-neutral-400 hover:text-white'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Files Changed</span>
                </button>
              </div>
            </div>

            {/* Subtab 1: Conversation Timeline */}
            {activePrTab === 'conversation' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* PR Initial Description Box (GitHub Style) */}
                <div className="border border-white/10 rounded-xl bg-white/[0.03] overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-neutral-300">
                    <div className="flex items-center gap-2">
                      {selectedPr.requester.avatar ? (
                        <img src={selectedPr.requester.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-sky-600 flex items-center justify-center text-[9px] font-bold text-white">
                          {selectedPr.requester.name[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <span className="font-semibold text-white">{selectedPr.requester.name}</span>
                      <span className="text-neutral-500">opened this pull request</span>
                    </div>
                    <span className="text-neutral-500 font-mono text-[10.5px]">
                      {new Date(selectedPr.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="p-4 text-xs leading-relaxed text-neutral-200 whitespace-pre-wrap">
                    {selectedPr.description || 'No description provided.'}
                  </div>
                </div>

                {/* Timeline Events */}
                {selectedPr.timeline && selectedPr.timeline.map((event) => {
                  if (event.type === 'opened') return null; // rendered in top box
                  return (
                    <div key={event.id} className="flex items-start gap-3 pl-4 border-l-2 border-white/10 ml-5 py-1">
                      <div className="mt-0.5">
                        {event.type === 'approved' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : event.type === 'changes_requested' ? (
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                        ) : event.type === 'merged' ? (
                          <GitMerge className="w-4 h-4 text-purple-400" />
                        ) : event.type === 'closed' ? (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-sky-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-[11.5px]">
                          <span className="font-semibold text-white">{event.author.name}</span>
                          <span className="text-neutral-400">
                            {event.type === 'approved' && 'approved these changes'}
                            {event.type === 'changes_requested' && 'requested changes'}
                            {event.type === 'merged' && 'merged this pull request'}
                            {event.type === 'closed' && 'closed this pull request'}
                            {event.type === 'comment' && 'commented'}
                          </span>
                          <span className="text-neutral-500 font-mono text-[10px]">
                            {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {event.content && (
                          <div className="p-3 rounded-lg border border-white/10 bg-black/30 text-neutral-300 text-xs whitespace-pre-wrap">
                            {event.content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Review Submission Box (GitHub Style) */}
                <div className="border border-white/10 rounded-xl bg-black/40 p-4 space-y-3">
                  <div className="flex items-center justify-between font-semibold text-neutral-200">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-400" />
                      Submit Review
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button
                        onClick={() => setReviewAction('approve')}
                        className={`px-2 py-0.5 rounded font-medium ${reviewAction === 'approve' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:text-white'}`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setReviewAction('request_changes')}
                        className={`px-2 py-0.5 rounded font-medium ${reviewAction === 'request_changes' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-neutral-400 hover:text-white'}`}
                      >
                        Request Changes
                      </button>
                      <button
                        onClick={() => setReviewAction('comment')}
                        className={`px-2 py-0.5 rounded font-medium ${reviewAction === 'comment' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-neutral-400 hover:text-white'}`}
                      >
                        Comment
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder={
                      reviewAction === 'approve'
                        ? 'Leave an optional approval comment...'
                        : reviewAction === 'request_changes'
                        ? 'Specify what needs to be changed before merge...'
                        : 'Write a comment on this pull request...'
                    }
                    className="w-full p-2.5 rounded-lg bg-black/40 border border-white/10 text-white placeholder-neutral-500 text-xs outline-none focus:border-sky-400 resize-none font-sans"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={handleSubmitReview}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {reviewAction === 'approve' && 'Submit Approval'}
                        {reviewAction === 'request_changes' && 'Submit Change Request'}
                        {reviewAction === 'comment' && 'Post Comment'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Subtab 2: Files Changed / Diff Preview */}
            {activePrTab === 'files' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-sky-400" />
                    <span className="text-neutral-300 font-medium">Comparing branches:</span>
                    <span className="font-mono text-sky-300">{selectedPr.branch}</span>
                    <span className="text-neutral-500">→</span>
                    <span className="font-mono text-emerald-300">{selectedPr.baseBranch || 'main'}</span>
                  </div>
                  <span className="text-neutral-400 font-mono text-[11px]">Ready to merge</span>
                </div>

                <div className="p-8 rounded-xl border border-white/5 bg-black/20 text-center space-y-2 text-neutral-400">
                  <FileCode2 className="w-8 h-8 mx-auto opacity-30 text-sky-400" />
                  <p className="font-medium text-xs text-neutral-300">Ready for Line-by-Line Code Review</p>
                  <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                    Use the 'Code Comments' sidebar panel in the IDE to leave inline discussions directly on specific code lines.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : isCreating ? (
          /* View 2: Create New Pull Request Form */
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleCreateRequest} className="space-y-4 max-w-xl mx-auto">
              <div className="font-semibold text-sm text-sky-400 flex items-center gap-2 mb-3">
                <GitPullRequest className="w-4 h-4" />
                <span>Open a New Pull Request</span>
              </div>

              <div>
                <label className="block font-medium mb-1 text-neutral-300">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Add real-time comments and WebSocket synchronization"
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-neutral-500 text-xs outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1 text-neutral-300">Head Branch (Source)</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="feature-branch"
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs font-mono outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1 text-neutral-300">Base Branch (Target)</label>
                  <input
                    type="text"
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs font-mono outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1 text-neutral-300">Assign Reviewer</label>
                {availableCollaborators.filter(c => c.id !== currentUser.id).length > 0 ? (
                  <select
                    value={selectedReviewerId}
                    onChange={(e) => setSelectedReviewerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xs outline-none focus:border-sky-400"
                  >
                    <option value="">Select a collaborator...</option>
                    {availableCollaborators.filter(c => c.id !== currentUser.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-neutral-400">
                    No other collaborators joined yet. Review will be open to all peers.
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium mb-1 text-neutral-300">Description / Review Notes</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem, proposed solution, and files modified..."
                  className="w-full p-3 rounded-lg bg-black/30 border border-white/10 text-white placeholder-neutral-500 text-xs outline-none focus:border-sky-400 resize-none font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-neutral-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors disabled:opacity-40"
                >
                  Create Pull Request
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* View 3: Pull Requests List (GitHub Style) */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Tabs */}
            <div 
              className="px-5 py-2 border-b flex items-center gap-2 bg-black/20 flex-shrink-0"
              style={{ borderColor: 'var(--ide-border)' }}
            >
              {(['all', 'open', 'merged', 'closed'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors ${
                    activeTab === t 
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredRequests.length === 0 ? (
                <div className="p-12 text-center space-y-2 text-neutral-500">
                  <GitPullRequest className="w-8 h-8 mx-auto opacity-30 text-sky-400" />
                  <p className="text-xs text-neutral-300 font-medium">No pull requests found.</p>
                  <p className="text-[11px] opacity-70">
                    Click 'New Pull Request' above to request peer code review.
                  </p>
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => setSelectedPrId(req.id)}
                    className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white group-hover:text-sky-400 transition-colors truncate">
                          {req.title}
                        </span>
                        <span className="text-neutral-500 font-mono text-[10.5px]">#{req.number || 1}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <span>by <strong className="text-neutral-300 font-medium">{req.requester.name}</strong></span>
                        <span>•</span>
                        <span className="font-mono text-[10.5px] text-sky-400/80">{req.branch}</span>
                        <span>→</span>
                        <span className="font-mono text-[10.5px] text-emerald-400/80">{req.baseBranch || 'main'}</span>
                        <span>•</span>
                        <span className="text-neutral-500 font-mono text-[10px]">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {getStatusBadge(req.status)}
                      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
