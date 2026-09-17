'use client';

import React, { useState, useEffect } from 'react';
import { InlineCommentThread, CommentAuthor } from '@/lib/collaboration/types';
import { CommentService } from '@/lib/collaboration/comment-service';
import { 
  MessageSquare, 
  Check, 
  RotateCcw, 
  Trash2, 
  Send, 
  X, 
  CornerDownRight, 
  Clock, 
  FileCode2,
  ChevronDown,
  ChevronRight,
  Filter,
  ExternalLink
} from 'lucide-react';

interface InlineCommentsOverlayProps {
  projectId: string;
  activeFilePath: string | null;
  currentUser: CommentAuthor;
  onNavigateToLine?: (line: number) => void;
  onOpenFile?: (filePath: string, line?: number) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function InlineCommentsOverlay({
  projectId,
  activeFilePath,
  currentUser,
  onNavigateToLine,
  onOpenFile,
  isOpen = true,
  onClose,
}: InlineCommentsOverlayProps) {
  const [threads, setThreads] = useState<InlineCommentThread[]>([]);
  const [replyText, setReplyText] = useState<{ [threadId: string]: string }>({});
  const [newLineComment, setNewLineComment] = useState<{ filePath: string; line: number; text: string } | null>(null);
  const [collapsedThreads, setCollapsedThreads] = useState<{ [threadId: string]: boolean }>({});
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [scope, setScope] = useState<'all_files' | 'current_file'>('all_files');

  const refreshThreads = () => {
    const list = CommentService.getThreads(
      projectId, 
      scope === 'current_file' && activeFilePath ? activeFilePath : undefined
    );
    setThreads(list);
  };

  useEffect(() => {
    refreshThreads();

    const handleUpdate = () => refreshThreads();
    window.addEventListener('radiux:comments-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('radiux:comments-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [projectId, activeFilePath, scope]);

  if (!isOpen) return null;

  const filteredThreads = threads.filter((t) => {
    if (filter === 'open') return t.status === 'open';
    if (filter === 'resolved') return t.status === 'resolved';
    return true;
  });

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineComment || !newLineComment.text.trim()) return;

    CommentService.createThread(
      projectId,
      newLineComment.filePath || activeFilePath || 'index.html',
      newLineComment.line,
      newLineComment.text.trim(),
      currentUser
    );
    setNewLineComment(null);
    refreshThreads();
  };

  const handleReply = (threadId: string) => {
    const text = replyText[threadId]?.trim();
    if (!text) return;

    CommentService.addReply(projectId, threadId, text, currentUser);
    setReplyText((prev) => ({ ...prev, [threadId]: '' }));
    refreshThreads();
  };

  const handleResolve = (threadId: string) => {
    CommentService.resolveThread(projectId, threadId, currentUser);
    refreshThreads();
  };

  const handleReopen = (threadId: string) => {
    CommentService.reopenThread(projectId, threadId);
    refreshThreads();
  };

  const handleDelete = (threadId: string, commentId: string) => {
    CommentService.deleteComment(projectId, threadId, commentId, currentUser.id);
    refreshThreads();
  };

  const toggleCollapse = (threadId: string) => {
    setCollapsedThreads((prev) => ({ ...prev, [threadId]: !prev[threadId] }));
  };

  const handleJumpToComment = (filePath: string, line: number) => {
    if (onOpenFile) {
      onOpenFile(filePath, line);
    } else if (onNavigateToLine && filePath === activeFilePath) {
      onNavigateToLine(line);
    }
  };

  // Group threads by file path
  const threadsByFile = filteredThreads.reduce<{ [file: string]: InlineCommentThread[] }>((acc, thread) => {
    if (!acc[thread.filePath]) acc[thread.filePath] = [];
    acc[thread.filePath].push(thread);
    return acc;
  }, {});

  return (
    <div 
      className="flex flex-col h-full border-l text-xs select-none"
      style={{
        backgroundColor: 'var(--ide-bg)',
        borderColor: 'var(--ide-border)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Header */}
      <div 
        className="h-10 px-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-sidebar)' }}
      >
        <div className="flex items-center gap-2 font-medium">
          <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
          <span className="truncate">Code Comments</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-neutral-300 font-mono">
            {threads.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-black/30 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-neutral-300 outline-none"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scope Selector Bar (All Files vs Current File) */}
      <div 
        className="px-3 py-1.5 border-b flex items-center justify-between bg-black/20 text-[11px]"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScope('all_files')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              scope === 'all_files'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All Files
          </button>
          <button
            onClick={() => setScope('current_file')}
            disabled={!activeFilePath}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              scope === 'current_file'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-neutral-400 hover:text-white disabled:opacity-30'
            }`}
          >
            {activeFilePath ? activeFilePath : 'No File'}
          </button>
        </div>

        <button
          onClick={() => setNewLineComment({ 
            filePath: activeFilePath || 'index.html', 
            line: 1, 
            text: '' 
          })}
          className="text-sky-400 hover:underline flex items-center gap-1 text-[10.5px] font-medium"
        >
          + Add Comment
        </button>
      </div>

      {/* New Comment Creator Form */}
      {newLineComment && (
        <form onSubmit={handleCreateThread} className="p-3 border-b border-sky-500/30 bg-sky-500/5 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-300 truncate">
              <FileCode2 className="w-3.5 h-3.5 flex-shrink-0 text-sky-400" />
              <input
                type="text"
                value={newLineComment.filePath}
                onChange={(e) => setNewLineComment({ ...newLineComment, filePath: e.target.value })}
                placeholder="file path (e.g. index.html)"
                className="w-32 px-1.5 py-0.5 rounded bg-black/40 border border-sky-500/30 text-[11px] text-white outline-none font-mono"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-400">Line:</span>
              <input
                type="number"
                min={1}
                value={newLineComment.line}
                onChange={(e) => setNewLineComment({ ...newLineComment, line: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-12 px-1.5 py-0.5 rounded bg-black/40 border border-sky-500/40 text-center font-mono text-[11px] text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setNewLineComment(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <textarea
            autoFocus
            rows={2}
            value={newLineComment.text}
            onChange={(e) => setNewLineComment({ ...newLineComment, text: e.target.value })}
            placeholder="Write inline comment..."
            className="w-full p-2 rounded bg-black/40 border border-sky-500/30 text-white placeholder-neutral-500 text-xs outline-none focus:border-sky-400 resize-none font-sans"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewLineComment(null)}
              className="px-2 py-0.5 rounded text-[10.5px] text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newLineComment.text.trim()}
              className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold flex items-center gap-1 disabled:opacity-40"
            >
              <Send className="w-3 h-3" />
              <span>Post Comment</span>
            </button>
          </div>
        </form>
      )}

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center space-y-2 text-neutral-500">
            <MessageSquare className="w-6 h-6 mx-auto opacity-30" />
            <p className="text-xs">No inline comments yet.</p>
            <p className="text-[11px] opacity-70">
              Click '+ Add Comment' to leave line-specific feedback.
            </p>
          </div>
        ) : (
          Object.entries(threadsByFile).map(([filePath, fileThreads]) => (
            <div key={filePath} className="space-y-2">
              {/* File Group Header */}
              <div 
                onClick={() => handleJumpToComment(filePath, fileThreads[0]?.startLine || 1)}
                className="flex items-center justify-between px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-300 text-[11px] font-mono cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileCode2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <span className="truncate">{filePath}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-neutral-400">
                  {fileThreads.length}
                </span>
              </div>

              {/* Thread Cards in this File */}
              {fileThreads.map((thread) => {
                const isCollapsed = collapsedThreads[thread.id];
                const isResolved = thread.status === 'resolved';

                return (
                  <div
                    key={thread.id}
                    className={`rounded-lg border transition-all ${
                      isResolved
                        ? 'border-white/5 bg-white/[0.02] opacity-75'
                        : 'border-white/10 bg-white/[0.04] shadow-sm'
                    }`}
                  >
                    {/* Thread Header (Line Anchor) */}
                    <div 
                      className="px-2.5 py-1.5 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5"
                      onClick={() => toggleCollapse(thread.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJumpToComment(thread.filePath, thread.startLine);
                          }}
                          className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px] hover:bg-sky-500/30 flex items-center gap-1"
                          title="Jump to line in editor"
                        >
                          <span>Line {thread.startLine}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {isResolved ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReopen(thread.id);
                            }}
                            className="p-1 rounded hover:bg-white/10 text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[10px]"
                            title="Reopen thread"
                          >
                            <Check className="w-3 h-3" />
                            <span>Resolved</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolve(thread.id);
                            }}
                            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-emerald-400 transition-colors"
                            title="Mark thread as resolved"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Thread Body (Comments) */}
                    {!isCollapsed && (
                      <div className="p-2.5 space-y-2.5">
                        {thread.comments.map((comment, index) => {
                          const isAuthor = comment.author.id === currentUser.id;
                          return (
                            <div key={comment.id} className="space-y-1 group">
                              <div className="flex items-center justify-between text-[10.5px]">
                                <div className="flex items-center gap-1.5">
                                  {comment.author.avatar ? (
                                    <img
                                      src={comment.author.avatar}
                                      alt=""
                                      className="w-4 h-4 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-sky-600 flex items-center justify-center text-[9px] font-bold text-white">
                                      {comment.author.name[0]?.toUpperCase() || 'U'}
                                    </div>
                                  )}
                                  <span className="font-semibold text-neutral-200">
                                    {comment.author.name}
                                  </span>
                                  <span className="text-[9.5px] text-neutral-500 font-mono">
                                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                {isAuthor && (
                                  <button
                                    onClick={() => handleDelete(thread.id, comment.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-500 hover:text-rose-400 transition-opacity"
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <p className="text-[11.5px] text-neutral-300 pl-5.5 leading-relaxed break-words whitespace-pre-wrap">
                                {comment.content}
                              </p>
                            </div>
                          );
                        })}

                        {/* Reply Form */}
                        {!isResolved && (
                          <div className="pt-2 border-t border-white/5 flex items-center gap-1.5">
                            <CornerDownRight className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                            <input
                              type="text"
                              value={replyText[thread.id] || ''}
                              onChange={(e) => setReplyText({ ...replyText, [thread.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleReply(thread.id);
                                }
                              }}
                              placeholder="Reply to thread..."
                              className="flex-1 px-2 py-1 rounded bg-black/40 border border-white/10 text-white placeholder-neutral-500 text-[11px] outline-none focus:border-sky-500/50"
                            />
                            <button
                              onClick={() => handleReply(thread.id)}
                              disabled={!replyText[thread.id]?.trim()}
                              className="p-1 rounded bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-30 transition-colors"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
