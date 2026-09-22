'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Square,
  RefreshCw,
  Plus,
  Trash2,
  X,
  ChevronDown,
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileCode,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  Copy,
  Layers,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import {
  AIPermissionMode,
  DiffProposal,
  WorkspaceAIContext,
  AgentStreamEvent,
} from '@/lib/ai/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: { message: string; done?: boolean; error?: boolean }[];
  diffProposals?: DiffProposal[];
  pendingConfirmation?: {
    id: string;
    action: string;
    description: string;
    details?: any;
  };
}

interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: WorkspaceAIContext;
  onAcceptDiff: (proposal: DiffProposal) => void;
  onRejectDiff: (proposal: DiffProposal) => void;
  onReviewDiff: (proposal: DiffProposal) => void;
}

export function AIAgentPanel({
  isOpen,
  onClose,
  context,
  onAcceptDiff,
  onRejectDiff,
  onReviewDiff,
}: AIAgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${context.user.name || 'Developer'}! I'm your **Radiux AI Coding Agent**.\n\nI can inspect your workspace, search codebase symbols, propose surgical edits with diff previews, run terminal checks, and fix build errors.\n\nHow can I help you in **${context.project.name}** today?`,
    },
  ]);

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [permissionMode, setPermissionMode] = useState<AIPermissionMode>('ASSISTED');
  const [activeModel, setActiveModel] = useState('llama-3.3-70b-versatile');
  const [panelWidth, setPanelWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new message or stream token
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 750) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleNewChat = () => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([
      {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `New session started. Workspace: **${context.project.name}**. What would you like to build or inspect?`,
      },
    ]);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleSend = async (overridePrompt?: string) => {
    const promptToSend = overridePrompt || input;
    if (!promptToSend.trim() || isGenerating) return;

    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `asst_${Date.now()}`;

    const newMessages: Message[] = [
      ...messages,
      { id: userMessageId, role: 'user', content: promptToSend },
      { id: assistantMessageId, role: 'assistant', content: '', steps: [] },
    ];

    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          userMessage: promptToSend,
          context,
          permissionMode,
          history: messages
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errJson.error || `HTTP ${response.status}: Failed to reach AI service`);
      }

      if (!response.body) throw new Error('Response body stream unavailable');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawData = line.slice(6).trim();
            if (!rawData) continue;

            try {
              const event: AgentStreamEvent = JSON.parse(rawData);

              setMessages((prev) => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                if (lastIdx < 0 || copy[lastIdx].id !== assistantMessageId) return prev;
                const curr = { ...copy[lastIdx] };

                switch (event.type) {
                  case 'token':
                    curr.content += event.token;
                    break;
                  case 'status':
                    curr.steps = [...(curr.steps || []), { message: event.message }];
                    break;
                  case 'tool_start':
                    curr.steps = [
                      ...(curr.steps || []),
                      { message: `Using tool: ${event.toolName}` },
                    ];
                    break;
                  case 'tool_finish':
                    // Mark last step done
                    if (curr.steps && curr.steps.length > 0) {
                      const s = [...curr.steps];
                      s[s.length - 1] = {
                        ...s[s.length - 1],
                        done: !event.error,
                        error: !!event.error,
                      };
                      curr.steps = s;
                    }
                    break;
                  case 'diff_proposal':
                    curr.diffProposals = [...(curr.diffProposals || []), event.proposal];
                    break;
                  case 'permission_request':
                    curr.pendingConfirmation = {
                      id: event.id,
                      action: event.action,
                      description: event.description,
                      details: event.details,
                    };
                    break;
                  case 'error':
                    curr.content += `\n\n> ⚠️ **Error**: ${event.message}`;
                    break;
                  case 'done':
                    break;
                }

                copy[lastIdx] = curr;
                return copy;
              });
            } catch (parseErr) {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].id === assistantMessageId) {
            copy[lastIdx] = {
              ...copy[lastIdx],
              content: copy[lastIdx].content + `\n\n> ⚠️ **Agent Error**: ${err.message}`,
            };
          }
          return copy;
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleConfirmAction = async (messageId: string, actionId: string) => {
    // Clear pending confirmation
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, pendingConfirmation: undefined } : m
      )
    );
    // Continue with confirmed action
    handleSend(`[Confirmed action: ${actionId}] Please proceed with the operation.`);
  };

  const handleDenyAction = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, pendingConfirmation: undefined } : m
      )
    );
  };

  return (
    <div
      className="relative h-full flex flex-col border-l border-white/10 z-20 select-none"
      style={{
        width: `${panelWidth}px`,
        backgroundColor: 'var(--ide-bg, #181818)',
      }}
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={() => setIsDragging(true)}
        className="absolute -left-1 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-500/40 transition-colors z-30"
        title="Drag to resize AI panel"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-neutral-900/60">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-sky-500/10 text-sky-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-neutral-200">AI Agent</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-neutral-400 border border-white/[0.06]">
            {activeModel.replace('-versatile', '')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Permission Mode Selector */}
          <div className="relative group">
            <button
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.06]"
              title={`Permission Mode: ${permissionMode}`}
            >
              {permissionMode === 'READ_ONLY' && <Shield className="w-2.5 h-2.5 text-neutral-400" />}
              {permissionMode === 'ASSISTED' && <ShieldCheck className="w-2.5 h-2.5 text-sky-400" />}
              {permissionMode === 'AUTONOMOUS' && <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />}
              <span>{permissionMode}</span>
              <ChevronDown className="w-2.5 h-2.5 text-neutral-500" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-36 rounded-lg bg-neutral-900 border border-white/10 shadow-xl p-1 z-40 text-xs">
              <button
                onClick={() => setPermissionMode('READ_ONLY')}
                className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 text-[11px] ${
                  permissionMode === 'READ_ONLY' ? 'bg-sky-500/20 text-sky-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>READ_ONLY</span>
              </button>
              <button
                onClick={() => setPermissionMode('ASSISTED')}
                className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 text-[11px] ${
                  permissionMode === 'ASSISTED' ? 'bg-sky-500/20 text-sky-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-sky-400" />
                <span>ASSISTED</span>
              </button>
              <button
                onClick={() => setPermissionMode('AUTONOMOUS')}
                className={`w-full text-left px-2 py-1 rounded flex items-center gap-1.5 text-[11px] ${
                  permissionMode === 'AUTONOMOUS' ? 'bg-sky-500/20 text-sky-300' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span>AUTONOMOUS</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClearChat}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Close AI Agent Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs select-text">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col gap-1.5 ${
              m.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Header role label */}
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 px-1 font-mono">
              {m.role === 'user' ? (
                <span>You</span>
              ) : (
                <span className="flex items-center gap-1 text-sky-400 font-semibold">
                  <Sparkles className="w-2.5 h-2.5" />
                  Radiux Agent
                </span>
              )}
            </div>

            {/* Bubble */}
            <div
              className={`rounded-xl px-3.5 py-2.5 max-w-[95%] leading-relaxed break-words whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white/[0.04] text-neutral-200 border border-white/[0.06]'
              }`}
            >
              {m.content}

              {/* Temporary Agent Execution Steps */}
              {m.steps && m.steps.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                    Agent Activity
                  </div>
                  {m.steps.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-center gap-2 text-[11px] font-mono text-neutral-400"
                    >
                      {step.error ? (
                        <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                      ) : step.done ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0" />
                      )}
                      <span className="truncate">{step.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending Confirmation Dialog */}
              {m.pendingConfirmation && (
                <div className="mt-3 p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Confirmation Required</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-200/90 leading-relaxed">
                    {m.pendingConfirmation.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      onClick={() =>
                        handleConfirmAction(m.id, m.pendingConfirmation!.id)
                      }
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] transition-colors"
                    >
                      Approve & Run
                    </button>
                    <button
                      onClick={() => handleDenyAction(m.id)}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              )}

              {/* Diff Proposal Cards */}
              {m.diffProposals && m.diffProposals.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-semibold text-neutral-300">
                      Proposed Changes ({m.diffProposals.length} file{m.diffProposals.length > 1 ? 's' : ''}):
                    </span>
                    {m.diffProposals.length > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            m.diffProposals?.forEach((p) => onAcceptDiff(p));
                          }}
                          className="px-2 py-0.5 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-medium"
                        >
                          Accept All
                        </button>
                        <button
                          onClick={() => {
                            m.diffProposals?.forEach((p) => onRejectDiff(p));
                          }}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px]"
                        >
                          Reject All
                        </button>
                      </div>
                    )}
                  </div>

                  {m.diffProposals.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-2.5 rounded-lg bg-neutral-950/60 border border-white/10 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-sky-300 truncate">
                          <FileCode className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{prop.path}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono">
                          diff
                        </span>
                      </div>

                      {prop.summary && (
                        <p className="text-[11px] text-neutral-400 leading-tight">
                          {prop.summary}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                        <button
                          onClick={() => onReviewDiff(prop)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] transition-colors"
                        >
                          <Layers className="w-3 h-3" />
                          <span>Review</span>
                        </button>
                        <button
                          onClick={() => onAcceptDiff(prop)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => onRejectDiff(prop)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[11px] transition-colors"
                        >
                          <X className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input Area */}
      <div className="p-3 border-t border-white/10 bg-neutral-900/40 flex flex-col gap-2">
        {/* Context chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] text-neutral-400 pb-1">
          {context.activeFile && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] shrink-0 font-mono">
              <FileCode className="w-2.5 h-2.5 text-sky-400" />
              <span>{context.activeFile.path.split('/').pop()}</span>
              {context.activeFile.selection && context.activeFile.selection.text.trim() && (
                <span className="text-sky-400">
                  (L{context.activeFile.selection.startLine}-{context.activeFile.selection.endLine})
                </span>
              )}
            </div>
          )}

          {context.git?.branch && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] shrink-0 font-mono">
              <GitBranch className="w-2.5 h-2.5 text-neutral-400" />
              <span>{context.git.branch}</span>
            </div>
          )}
        </div>

        {/* Textarea & Actions */}
        <div className="relative rounded-xl border border-white/10 bg-neutral-950/60 focus-within:border-sky-500/50 transition-colors p-2">
          <textarea
            ref={textareaRef}
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask AI agent to inspect files, edit code, run terminal..."
            className="w-full bg-transparent text-xs text-neutral-200 placeholder-neutral-500 outline-none resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
            <span className="text-[10px] text-neutral-500 font-mono">
              Enter to send · Shift+Enter for newline
            </span>

            {isGenerating ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-500 text-white text-[11px] font-medium transition-colors"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white text-[11px] font-medium transition-colors shadow-sm"
              >
                <Send className="w-3 h-3" />
                <span>Run</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
