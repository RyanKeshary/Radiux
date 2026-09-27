'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Key,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  History,
  MessageSquare,
  Zap,
  ChevronLeft,
} from 'lucide-react';
import {
  AIPermissionMode,
  DiffProposal,
  WorkspaceAIContext,
  AgentStreamEvent,
  TaskIntentMode,
  AgentTask,
} from '@/lib/ai/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  steps?: { message: string; done?: boolean; error?: boolean }[];
  diffProposals?: DiffProposal[];
  task?: Partial<AgentTask>;
  pendingConfirmation?: {
    id: string;
    action: string;
    description: string;
    details?: any;
  };
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  projectId: string;
}

interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  context: WorkspaceAIContext;
  onAcceptDiff: (proposal: DiffProposal) => void;
  onRejectDiff: (proposal: DiffProposal) => void;
  onReviewDiff: (proposal: DiffProposal) => void;
  onRevertDiff?: (proposal: DiffProposal) => void;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
  files?: { id: string; name: string; content?: string }[];
}

export function AIAgentPanel({
  isOpen,
  onClose,
  context,
  onAcceptDiff,
  onRejectDiff,
  onReviewDiff,
  onRevertDiff,
  initialPrompt,
  onClearInitialPrompt,
  files = [],
}: AIAgentPanelProps) {
  const STORAGE_KEY = `zodiac_sessions_${context.project?.id || 'default'}`;

  const loadSessions = useCallback((): ChatSession[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }, [STORAGE_KEY]);

  const saveSessions = useCallback((sessions: ChatSession[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-30)));
  }, [STORAGE_KEY]);

  const makeWelcomeMsg = (): Message => ({
    id: 'init_welcome', role: 'assistant', timestamp: Date.now(),
    content: 'Hello! I am **Zodiac 1.0**, your native AI coding agent. I can inspect your project, search files, run diagnostics, test builds, and propose structured code edits.',
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const saved = loadSessions();
    return saved.length > 0 ? saved[saved.length - 1].id : `session_${Date.now()}`;
  });
  const [showHistory, setShowHistory] = useState(false);

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadSessions();
    if (saved.length > 0) {
      const last = saved[saved.length - 1];
      return last.messages.length > 0 ? last.messages : [makeWelcomeMsg()];
    }
    return [makeWelcomeMsg()];
  });

  useEffect(() => {
    if (messages.length === 0) return;
    const now = Date.now();
    const firstUser = messages.find(m => m.role === 'user');
    const title = firstUser
      ? firstUser.content.slice(0, 48) + (firstUser.content.length > 48 ? '…' : '')
      : 'New Chat';
    setSessions(prev => {
      const existing = prev.find(s => s.id === currentSessionId);
      const next = existing
        ? prev.map(s => s.id === currentSessionId ? { ...s, messages, title, updatedAt: now } : s)
        : [...prev, { id: currentSessionId, title, messages, createdAt: now, updatedAt: now, projectId: context.project?.id || 'default' }];
      saveSessions(next);
      return next;
    });
  }, [messages]);

  const startNewSession = () => {
    if (isGenerating && abortControllerRef.current) abortControllerRef.current.abort();
    const id = `session_${Date.now()}`;
    setCurrentSessionId(id);
    setMessages([makeWelcomeMsg()]);
    setShowHistory(false);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  const deleteSession = (sessionId: string) => {
    setSessions(prev => { const next = prev.filter(s => s.id !== sessionId); saveSessions(next); return next; });
    if (sessionId === currentSessionId) startNewSession();
  };

  const [input, setInput] = useState('');
  const [permissionMode, setPermissionMode] = useState<AIPermissionMode>('ASSISTED');
  const [isPermissionMenuOpen, setIsPermissionMenuOpen] = useState(false);
  const [intentMode, setIntentMode] = useState<TaskIntentMode>('AGENT');
  const [isIntentMenuOpen, setIsIntentMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const intentMenuRef = useRef<HTMLDivElement>(null);

  // Ratings & Copy Feedback state
  const [ratings, setRatings] = useState<Record<string, 'like' | 'dislike'>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);


  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          type: 'copy',
          contentPreview: content,
          userEmail: context.user.email,
          userName: context.user.name,
        }),
      }).catch(() => {});
    } catch (e) {
      console.error('Failed to copy text', e);
    }
  };

  const handleRateMessage = async (messageId: string, type: 'like' | 'dislike', content: string) => {
    setRatings((prev) => ({ ...prev, [messageId]: type }));
    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          type,
          contentPreview: content,
          userEmail: context.user.email,
          userName: context.user.name,
          model: activeModel,
        }),
      });
    } catch (e) {
      console.error('Failed to record rating', e);
    }
  };

  const handleRevertDiff = async (proposal: DiffProposal, messageId: string) => {
    if (onRevertDiff) {
      onRevertDiff(proposal);
    }
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              diffProposals: msg.diffProposals?.map((dp) =>
                dp.id === proposal.id ? { ...dp, status: 'reverted' } : dp
              ),
            }
          : msg
      )
    );
    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          type: 'revert',
          filePath: proposal.path,
          contentPreview: `Reverted diff for ${proposal.path}`,
          userEmail: context.user.email,
          userName: context.user.name,
        }),
      });
    } catch (e) {
      console.error('Failed to record revert feedback', e);
    }
  };

  // Project Memory state & persistence
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [projectMemoryText, setProjectMemoryText] = useState(
    context.projectMemory?.coding_conventions || ''
  );
  const [memorySaveStatus, setMemorySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // API Key management state
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isKeyConfigured, setIsKeyConfigured] = useState<boolean>(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Target file linking state
  const [linkedFiles, setLinkedFiles] = useState<string[]>([]);
  const [isLinkingFileOpen, setIsLinkingFileOpen] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');

  const [activeModel, setActiveModel] = useState('llama-3.3-70b-versatile');
  const [panelWidth, setPanelWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const permissionMenuRef = useRef<HTMLDivElement>(null);
  const filePickerRef = useRef<HTMLDivElement>(null);

  // Check API key configuration on load & sync from localStorage if present
  useEffect(() => {
    const checkKeyStatus = async () => {
      try {
        const res = await fetch('/api/ai/set-key');
        if (res.ok) {
          const data = await res.json();
          setIsKeyConfigured(!!data.configured);
          if (!data.configured && typeof window !== 'undefined') {
            const savedLocal = localStorage.getItem('radiux_groq_api_key');
            if (savedLocal && savedLocal.trim().length > 5) {
              await fetch('/api/ai/set-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: savedLocal.trim() }),
              });
              setIsKeyConfigured(true);
            }
          }
        }
      } catch (e) {}
    };
    checkKeyStatus();
  }, []);

  // Fetch project memory from DB on mount / when projectId changes
  useEffect(() => {
    if (!context.project.id) return;
    const fetchMemory = async () => {
      try {
        const res = await fetch(`/api/ai/project-context?projectId=${context.project.id}`);
        if (res.ok) {
          const data = await res.json();
          const savedText = data.context?.coding_conventions || data.context?.codingConventions || '';
          if (savedText) {
            setProjectMemoryText(savedText);
            if (context.projectMemory) {
              context.projectMemory.coding_conventions = savedText;
            }
          }
        }
      } catch (e) {
        if (typeof window !== 'undefined') {
          const localMem = localStorage.getItem(`radiux_project_memory_${context.project.id}`);
          if (localMem) setProjectMemoryText(localMem);
        }
      }
    };
    fetchMemory();
  }, [context.project.id]);

  // Click outside listener for Permission Menu and File Picker
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        permissionMenuRef.current &&
        !permissionMenuRef.current.contains(e.target as Node)
      ) {
        setIsPermissionMenuOpen(false);
      }
      if (
        intentMenuRef.current &&
        !intentMenuRef.current.contains(e.target as Node)
      ) {
        setIsIntentMenuOpen(false);
      }
      if (
        filePickerRef.current &&
        !filePickerRef.current.contains(e.target as Node)
      ) {
        setIsLinkingFileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sync initialPrompt into input if provided
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [initialPrompt, onClearInitialPrompt]);

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

  const handleNewChat = () => startNewSession();

  const handleClearChat = () => {
    setMessages([makeWelcomeMsg()]);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleSaveApiKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) return;
    setIsSavingKey(true);
    setKeyStatusMsg(null);
    try {
      const res = await fetch('/api/ai/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save key');
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('radiux_groq_api_key', key);
      }
      setIsKeyConfigured(true);
      setKeyStatusMsg({ type: 'success', text: 'Groq API Key configured successfully!' });
      setTimeout(() => {
        setIsKeyModalOpen(false);
        setKeyStatusMsg(null);
        setApiKeyInput('');
      }, 1200);
    } catch (err: any) {
      setKeyStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveMemory = async () => {
    setMemorySaveStatus('saving');
    try {
      const res = await fetch('/api/ai/project-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: context.project.id,
          coding_conventions: projectMemoryText,
          codingConventions: projectMemoryText,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to persist memory');
      }

      // Sync to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(`radiux_project_memory_${context.project.id}`, projectMemoryText);
      }

      // Update in current workspace context
      if (!context.projectMemory) {
        context.projectMemory = {};
      }
      context.projectMemory.coding_conventions = projectMemoryText;

      setMemorySaveStatus('saved');
      setTimeout(() => {
        setMemorySaveStatus('idle');
        setIsMemoryOpen(false);
      }, 1500);
    } catch (e) {
      console.error('[Zodiac Memory] Save error:', e);
      setMemorySaveStatus('error');
      setTimeout(() => setMemorySaveStatus('idle'), 2500);
    }
  };

  const handleSend = async (overridePrompt?: string) => {
    const promptToSend = overridePrompt || input;
    if (!promptToSend.trim() || isGenerating) return;

    // Gather contents for linked target files if specified
    const targetFileObjects = linkedFiles.map((filePath) => {
      const found = files.find((f) => f.name === filePath);
      return {
        path: filePath,
        content: found?.content || (context.activeFile?.path === filePath ? context.activeFile.content : undefined),
      };
    });

    // If target files are linked, prepend target instruction
    let finalPrompt = promptToSend;
    if (linkedFiles.length > 0) {
      finalPrompt = `[TARGET FILES SPECIFICALLY LINKED FOR EDIT]:\n${linkedFiles.map((f) => `- ${f}`).join('\n')}\n\nPlease inspect these target file(s) and apply your code edits/diffs directly to them according to the user request:\n\n${promptToSend}`;
    }

    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `asst_${Date.now() + 1}`;
    const ts = Date.now();

    const newMessages: Message[] = [
      ...messages,
      { id: userMessageId, role: 'user', content: promptToSend, timestamp: ts },
      { id: assistantMessageId, role: 'assistant', content: '', steps: [], timestamp: ts + 1 },
    ];

    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const storedUserKey = typeof window !== 'undefined' ? localStorage.getItem('radiux_groq_api_key') || '' : '';

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedUserKey ? { 'x-groq-api-key': storedUserKey } : {}),
        },
        signal: abortController.signal,
        body: JSON.stringify({
          userMessage: finalPrompt,
          context: {
            ...context,
            intentMode,
            targetFiles: targetFileObjects.length > 0 ? targetFileObjects : undefined,
          },
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

        const events: AgentStreamEvent[] = [];
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawData = line.slice(6).trim();
            if (!rawData) continue;
            try {
              events.push(JSON.parse(rawData));
            } catch (parseErr) {}
          }
        }

        if (events.length > 0) {
          setMessages((prev) => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx < 0 || copy[lastIdx].id !== assistantMessageId) return prev;
            let curr = { ...copy[lastIdx] };

            for (const event of events) {
              switch (event.type) {
                case 'token':
                  curr.content += event.token;
                  if (curr.steps && curr.steps.length > 0) {
                    const updated = [...curr.steps];
                    for (let i = 0; i < updated.length; i++) {
                      if (!updated[i].error && !updated[i].done) {
                        updated[i] = { ...updated[i], done: true };
                      }
                    }
                    curr.steps = updated;
                  }
                  break;
                case 'status':
                  if (curr.steps && curr.steps.length > 0) {
                    const updated = curr.steps.map((st) =>
                      !st.error && !st.done ? { ...st, done: true } : st
                    );
                    curr.steps = [...updated, { message: event.message }];
                  } else {
                    curr.steps = [{ message: event.message }];
                  }
                  break;
                case 'tool_start':
                  if (curr.steps && curr.steps.length > 0) {
                    const updated = curr.steps.map((st) =>
                      !st.error && !st.done ? { ...st, done: true } : st
                    );
                    curr.steps = [...updated, { message: `Using tool: ${event.toolName}` }];
                  } else {
                    curr.steps = [{ message: `Using tool: ${event.toolName}` }];
                  }
                  break;
                case 'tool_finish':
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
                case 'task_state':
                  curr.task = { ...(curr.task || {}), ...event.task };
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
                  if (curr.steps && curr.steps.length > 0) {
                    curr.steps = curr.steps.map((st) =>
                      !st.error ? { ...st, done: true } : st
                    );
                  }
                  break;
              }
            }

            copy[lastIdx] = curr;
            return copy;
          });
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
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, pendingConfirmation: undefined } : m
      )
    );
    handleSend(`[Confirmed action: ${actionId}] Please proceed with the operation.`);
  };

  const handleDenyAction = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, pendingConfirmation: undefined } : m
      )
    );
  };

  // Available project files filtered by search query
  const filteredProjectFiles = files.filter((f) =>
    f.name.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffH = Math.floor(diffMins / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className="relative h-full flex z-20 select-none"
      style={{ width: `${panelWidth}px` }}
    >
      {/* History Sidebar */}
      {showHistory && (
        <div
          className="absolute inset-0 z-40 flex flex-col"
          style={{ background: 'rgba(14,14,20,0.97)', backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              <History className="w-4 h-4 text-sky-400" />
              Chat History
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/20">
                {sessions.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={startNewSession}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-neutral-500 text-xs gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <span>No saved sessions yet</span>
              </div>
            ) : (
              [...sessions].reverse().map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    session.id === currentSessionId
                      ? 'bg-sky-500/15 border border-sky-500/30'
                      : 'hover:bg-white/[0.05] border border-transparent hover:border-white/10'
                  }`}
                >
                  <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${session.id === currentSessionId ? 'text-sky-400' : 'text-neutral-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-200 truncate font-medium">{session.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-neutral-500">{formatTime(session.updatedAt)}</span>
                      <span className="text-[10px] text-neutral-600">·</span>
                      <span className="text-[10px] text-neutral-500">{session.messages.filter(m => m.role === 'user').length} messages</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="relative h-full flex flex-col border-l border-white/10 w-full" style={{ backgroundColor: 'var(--ide-bg, #0f0f14)' }}>
        {/* Resizer Handle */}
        <div
          onMouseDown={() => setIsDragging(true)}
          className="absolute -left-1 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-sky-500/50 transition-colors z-30 group"
          title="Drag to resize AI panel"
        >
          <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-white/20 group-hover:bg-sky-400/70 transition-colors" />
        </div>

        {/* Premium Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08] shrink-0"
          style={{ background: 'linear-gradient(180deg, rgba(14,14,22,0.98) 0%, rgba(10,10,18,0.95) 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-neutral-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white tracking-wide">ZODIAC</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md"
                  style={{ background: 'linear-gradient(90deg, rgba(14,165,233,0.2) 0%, rgba(99,102,241,0.2) 100%)', color: '#93c5fd', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  1.0
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-[9px] text-neutral-500 font-mono">{activeModel.replace('-versatile', '')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {/* History */}
            <button
              onClick={() => setShowHistory(v => !v)}
              className={`p-1.5 rounded-lg text-xs transition-colors relative ${showHistory ? 'bg-sky-500/20 text-sky-300' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
              title="Chat History"
            >
              <History className="w-3.5 h-3.5" />
              {sessions.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sky-500 text-[8px] flex items-center justify-center text-white font-bold" />
              )}
            </button>

            {/* API Key */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`p-1.5 rounded-lg text-xs transition-colors relative ${isKeyConfigured ? 'text-neutral-400 hover:text-white hover:bg-white/5' : 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'}`}
              title={isKeyConfigured ? 'Groq API Key Configured' : 'Configure Groq API Key'}
            >
              <Key className="w-3.5 h-3.5" />
              {!isKeyConfigured && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            </button>

            {/* Permission Mode */}
            {context.user.role === 'visitor' ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-400 border border-neutral-700">
                Read-Only
              </span>
            ) : (
              <div className="relative" ref={permissionMenuRef}>
                <button
                  onClick={() => setIsPermissionMenuOpen(prev => !prev)}
                  className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.06] transition-colors"
                  title={`Permission Mode: ${permissionMode}`}
                >
                  {permissionMode === 'READ_ONLY' && <Shield className="w-2.5 h-2.5 text-neutral-400" />}
                  {permissionMode === 'ASSISTED' && <ShieldCheck className="w-2.5 h-2.5 text-sky-400" />}
                  {permissionMode === 'AUTONOMOUS' && <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />}
                  <span>{permissionMode}</span>
                  <ChevronDown className="w-2.5 h-2.5 text-neutral-500" />
                </button>
                {isPermissionMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-40 rounded-xl bg-neutral-900/95 border border-white/10 shadow-2xl p-1 z-50 text-xs backdrop-blur-md flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                    {(['READ_ONLY', 'ASSISTED', 'AUTONOMOUS'] as AIPermissionMode[]).map(mode => (
                      <button key={mode} onClick={() => { setPermissionMode(mode); setIsPermissionMenuOpen(false); }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] cursor-pointer transition-colors ${permissionMode === mode ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}
                      >
                        <div className="flex items-center gap-2">
                          {mode === 'READ_ONLY' && <Shield className="w-3.5 h-3.5 text-neutral-400" />}
                          {mode === 'ASSISTED' && <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />}
                          {mode === 'AUTONOMOUS' && <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
                          <span>{mode}</span>
                        </div>
                        {permissionMode === mode && <Check className="w-3 h-3 text-sky-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Intent Mode */}
            <div className="relative" ref={intentMenuRef}>
              <button
                onClick={() => setIsIntentMenuOpen(prev => !prev)}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.06] transition-colors"
                title={`Task Intent: ${intentMode}`}
              >
                <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                <span>{intentMode}</span>
                <ChevronDown className="w-2.5 h-2.5 text-neutral-500" />
              </button>
              {isIntentMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl bg-neutral-900/95 border border-white/10 shadow-2xl p-1 z-50 text-xs backdrop-blur-md flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                  {(['AGENT', 'ASK', 'EXPLAIN', 'EDIT', 'DEBUG', 'BUILD', 'TEST', 'REVIEW'] as TaskIntentMode[]).map(mode => (
                    <button key={mode} onClick={() => { setIntentMode(mode); setIsIntentMenuOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] cursor-pointer transition-colors ${intentMode === mode ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}
                    >
                      <span>{mode}</span>
                      {intentMode === mode && <Check className="w-3 h-3 text-sky-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Memory */}
            <button onClick={() => setIsMemoryOpen(!isMemoryOpen)}
              className={`p-1.5 rounded-lg text-xs transition-colors ${isMemoryOpen ? 'bg-sky-500/20 text-sky-300' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
              title="Project AI Memory"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>

            <button onClick={startNewSession} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors" title="New Session">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors" title="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>



      {/* Project Memory Drawer (Persistent in Database) */}
      {isMemoryOpen && (
        <div className="p-3 border-b border-white/10 bg-neutral-900/95 text-xs flex flex-col gap-2 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between font-semibold text-neutral-200">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Project Memory & Instructions
            </span>
            <button onClick={() => setIsMemoryOpen(false)} className="text-neutral-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-neutral-400">
            Persistent architecture notes, conventions, and constraints stored in the database for Zodiac.
          </p>
          <textarea
            value={projectMemoryText}
            onChange={(e) => setProjectMemoryText(e.target.value)}
            placeholder="e.g. Always use Tailwind CSS, keep components small, avoid any in TypeScript..."
            rows={3}
            className="w-full p-2 rounded bg-neutral-950 border border-white/10 text-neutral-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-neutral-500">
              Saved automatically to cloud database
            </span>
            <button
              onClick={handleSaveMemory}
              disabled={memorySaveStatus === 'saving'}
              className={`flex items-center gap-1.5 px-3 py-1 text-white rounded text-[11px] font-medium transition-colors ${
                memorySaveStatus === 'saved'
                  ? 'bg-emerald-600'
                  : memorySaveStatus === 'error'
                  ? 'bg-red-600'
                  : 'bg-sky-600 hover:bg-sky-500'
              }`}
            >
              {memorySaveStatus === 'saving' && <RefreshCw className="w-3 h-3 animate-spin" />}
              {memorySaveStatus === 'saved' && <Check className="w-3 h-3 text-white" />}
              <span>
                {memorySaveStatus === 'saving'
                  ? 'Saving...'
                  : memorySaveStatus === 'saved'
                  ? 'Saved to Database!'
                  : memorySaveStatus === 'error'
                  ? 'Error Saving'
                  : 'Save Memory'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Groq Cloud API Key Modal */}
      {isKeyModalOpen && (
        <div className="p-3 border-b border-white/10 bg-neutral-900/95 text-xs flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between font-semibold text-neutral-200">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Key className="w-4 h-4" />
              <span>Configure Groq API Key</span>
            </div>
            <button onClick={() => setIsKeyModalOpen(false)} className="text-neutral-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Enter your Groq API key to power Zodiac with Llama 3.3 70B. Get a free key at{' '}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
            >
              console.groq.com/keys <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>

          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="gsk_..."
            className="w-full p-2 rounded bg-neutral-950 border border-white/10 text-neutral-200 text-xs focus:outline-none focus:border-sky-500 font-mono"
            autoFocus
          />

          {keyStatusMsg && (
            <div
              className={`text-[11px] px-2 py-1 rounded ${
                keyStatusMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {keyStatusMsg.text}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsKeyModalOpen(false)}
              className="px-2.5 py-1 rounded text-[11px] text-neutral-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveApiKey}
              disabled={isSavingKey || !apiKeyInput.trim()}
              className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded text-[11px] transition-colors"
            >
              {isSavingKey && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>Save & Apply Key</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs select-text scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.map((m) => {
          const isApiKeyError = m.content.includes('GROQ_API_KEY is not configured');
          return (
            <div
              key={m.id}
              className={`flex gap-2 group ${
                m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div className="shrink-0 mt-0.5">
                {m.role === 'user' ? (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
                  >
                    {(context.user.name || 'U')[0].toUpperCase()}
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' }}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>

              <div className={`flex flex-col gap-1 min-w-0 ${m.role === 'user' ? 'items-end' : 'items-start'} flex-1`}>
                {/* Role + timestamp */}
                <div className="flex items-center gap-1.5 px-0.5">
                  {m.role === 'user' ? (
                    <span className="text-[10px] text-neutral-400 font-medium">You</span>
                  ) : (
                    <span className="text-[10px] text-sky-400 font-semibold">Zodiac</span>
                  )}
                  {m.timestamp && (
                    <span className="text-[9px] text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(m.timestamp)}
                    </span>
                  )}
                </div>

              {/* Bubble */}
              <div
                className={`rounded-2xl px-3.5 py-2.5 max-w-[88%] leading-relaxed break-words whitespace-pre-wrap text-xs ${
                  m.role === 'user'
                    ? 'text-white shadow-lg shadow-sky-900/20'
                    : 'bg-white/[0.04] text-neutral-200 border border-white/[0.08] rounded-tl-sm'
                }`}
                style={m.role === 'user' ? { background: 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)' } : {}}
              >
                {/* Empty generating bubble → animated dots */}
                {m.role === 'assistant' && !m.content && isGenerating ? (
                  <span className="flex items-center gap-1 h-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : m.content}

                {/* If API key missing, render quick action button */}
                {isApiKeyError && (
                  <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400">Need to add your API key?</span>
                    <button
                      onClick={() => setIsKeyModalOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] transition-colors"
                    >
                      <Key className="w-3 h-3" />
                      <span>Configure Key</span>
                    </button>
                  </div>
                )}

                {/* Live Agent Task Execution State Card */}
                {m.task && (
                  <div className="mt-3 p-2.5 rounded-lg bg-neutral-900/80 border border-white/10 flex flex-col gap-2 font-sans">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <span>Task Execution</span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          ({m.task.intent_mode || 'AGENT'})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            m.task.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : m.task.status === 'FAILED'
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : m.task.status === 'VALIDATING'
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : m.task.status === 'WAITING_FOR_APPROVAL'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : m.task.status === 'MAX_STEPS_REACHED'
                              ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                              : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {m.task.status || 'RUNNING'}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          Step {m.task.current_step || 1}/{m.task.max_steps || 30}
                        </span>
                      </div>
                    </div>

                    {/* Metric Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {m.task.files_inspected && m.task.files_inspected.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-white/[0.04] text-neutral-300 border border-white/[0.06] font-mono">
                          🔍 {m.task.files_inspected.length} inspected
                        </span>
                      )}
                      {m.task.files_modified && m.task.files_modified.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono">
                          ✏️ {m.task.files_modified.length} modified
                        </span>
                      )}
                      {m.task.commands_run && m.task.commands_run.length > 0 && (
                        <span className="px-2 py-0.5 rounded bg-white/[0.04] text-neutral-300 border border-white/[0.06] font-mono">
                          💻 {m.task.commands_run.length} commands
                        </span>
                      )}
                    </div>

                    {/* Validation Results Badges */}
                    {m.task.validation_results && m.task.validation_results.length > 0 && (
                      <div className="flex flex-col gap-1 pt-1.5 border-t border-white/5">
                        <div className="text-[10px] font-semibold uppercase text-neutral-400">
                          Validation Results
                        </div>
                        {m.task.validation_results.map((vr: any, idx: number) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded ${
                              vr.passed
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-300 border border-red-500/20'
                            }`}
                          >
                            {vr.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            )}
                            <span className="capitalize">{vr.type.replace('run_', '')}:</span>
                            <span className="truncate">{vr.passed ? 'Passed with 0 errors' : 'Failed'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Temporary Agent Execution Steps */}
                {m.steps && m.steps.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-col gap-1.5">
                    <div className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                      Agent Activity
                    </div>
                    {m.steps.map((st, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono"
                      >
                        {st.error ? (
                          <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                        ) : st.done ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-sky-400 animate-spin shrink-0" />
                        )}
                        <span className="truncate">{st.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Interactive Permission Confirmation */}
                {m.pendingConfirmation && (
                  <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Action Approval Required ({permissionMode})</span>
                    </div>
                    <p className="text-[11px] text-neutral-300 leading-tight">
                      {m.pendingConfirmation.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
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

                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          {prop.status === 'accepted' ? (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Changes Applied
                              </span>
                              <button
                                onClick={() => handleRevertDiff(prop, m.id)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-medium transition-colors border border-amber-500/30"
                                title="Revert back to original file content"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>Revert Changes</span>
                              </button>
                            </div>
                          ) : prop.status === 'reverted' ? (
                            <div className="flex items-center gap-1 text-[10px] text-neutral-400 italic">
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              <span>Changes reverted to original</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onReviewDiff(prop)}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] transition-colors"
                              >
                                <Layers className="w-3 h-3" />
                                <span>Review</span>
                              </button>
                              <button
                                onClick={() => {
                                  onAcceptDiff(prop);
                                  setMessages((prev) =>
                                    prev.map((msg) =>
                                      msg.id === m.id
                                        ? {
                                            ...msg,
                                            diffProposals: msg.diffProposals?.map((dp) =>
                                              dp.id === prop.id ? { ...dp, status: 'accepted' } : dp
                                            ),
                                          }
                                        : msg
                                    )
                                  );
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={() => {
                                  onRejectDiff(prop);
                                  setMessages((prev) =>
                                    prev.map((msg) =>
                                      msg.id === m.id
                                        ? {
                                            ...msg,
                                            diffProposals: msg.diffProposals?.map((dp) =>
                                              dp.id === prop.id ? { ...dp, status: 'rejected' } : dp
                                            ),
                                          }
                                        : msg
                                    )
                                  );
                                }}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[11px] transition-colors"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Actions Toolbar: Copy, Like, Dislike, Revert */}
              <div className="flex items-center gap-1.5 px-1 pt-0.5">
                {/* Copy Message */}
                <button
                  onClick={() => handleCopyMessage(m.id, m.content)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-neutral-400 hover:text-neutral-200 hover:bg-white/5 transition-colors"
                  title="Copy message to clipboard"
                >
                  {copiedMessageId === m.id ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Assistant Ratings: Like / Dislike */}
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-0.5 border-l border-white/10 pl-1.5">
                    <button
                      onClick={() => handleRateMessage(m.id, 'like', m.content)}
                      className={`p-1 rounded text-[10px] transition-colors ${
                        ratings[m.id] === 'like'
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                      }`}
                      title="Good response (Like)"
                    >
                      <ThumbsUp className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => handleRateMessage(m.id, 'dislike', m.content)}
                      className={`p-1 rounded text-[10px] transition-colors ${
                        ratings[m.id] === 'dislike'
                          ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                      }`}
                      title="Poor response (Dislike)"
                    >
                      <ThumbsDown className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}

                {/* If message had diffs applied, option to revert all diffs */}
                {m.diffProposals && m.diffProposals.some((p) => p.status === 'accepted') && (
                  <button
                    onClick={() => {
                      m.diffProposals?.filter((p) => p.status === 'accepted').forEach((p) => handleRevertDiff(p, m.id));
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors ml-1 border border-amber-400/20"
                    title="Revert all applied code changes from this response"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Revert All</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input Area */}
      <div className="px-3 py-2.5 border-t border-white/[0.08] flex flex-col gap-2 relative shrink-0"
        style={{ background: 'linear-gradient(0deg, rgba(10,10,18,0.98) 0%, rgba(14,14,22,0.95) 100%)' }}
      >
        {/* Context & Target File Linking Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] text-neutral-400 scrollbar-none flex-wrap">
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
          {linkedFiles.map((file) => (
            <div key={file} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0 font-mono text-[10px] shadow-sm animate-in fade-in zoom-in-95 duration-100">
              <FileCode className="w-2.5 h-2.5 text-sky-400" />
              <span className="font-semibold text-white truncate max-w-[100px]">{file.split('/').pop()}</span>
              <span className="text-[9px] text-sky-300/80">(Target)</span>
              <button onClick={() => setLinkedFiles(prev => prev.filter(f => f !== file))} className="hover:text-red-400 text-sky-300 transition-colors ml-0.5">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {context.git?.branch && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] shrink-0 font-mono">
              <GitBranch className="w-2.5 h-2.5 text-neutral-400" />
              <span>{context.git.branch}</span>
            </div>
          )}
          <div className="relative shrink-0" ref={filePickerRef}>
            <button
              onClick={() => setIsLinkingFileOpen(prev => !prev)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] transition-colors"
              title="Link specific page or file for Zodiac to view and edit"
            >
              <Plus className="w-3 h-3" />
              <span>Link page to edit</span>
            </button>
            {isLinkingFileOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-72 rounded-xl bg-neutral-900/95 border border-white/10 shadow-2xl p-2.5 z-50 text-xs backdrop-blur-md flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1 border-b border-white/10">
                  <span className="font-semibold text-neutral-200 text-[11px]">Link Target Page / File</span>
                  <button onClick={() => setIsLinkingFileOpen(false)} className="text-neutral-400 hover:text-white"><X className="w-3 h-3" /></button>
                </div>
                <input type="text" value={fileSearchQuery} onChange={e => setFileSearchQuery(e.target.value)} placeholder="Search project files to link..." className="w-full px-2 py-1 rounded-lg bg-neutral-950 border border-white/10 text-neutral-200 text-[11px] focus:outline-none focus:border-sky-500 font-mono" autoFocus />
                <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
                  {filteredProjectFiles.length === 0 ? (
                    <div className="text-[11px] text-neutral-500 p-2 text-center">No matching files found</div>
                  ) : (
                    filteredProjectFiles.map(file => {
                      const isSelected = linkedFiles.includes(file.name);
                      return (
                        <button key={file.id || file.name} onClick={() => { if (isSelected) { setLinkedFiles(prev => prev.filter(f => f !== file.name)); } else { setLinkedFiles(prev => [...prev, file.name]); } }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-[11px] font-mono transition-colors ${isSelected ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'hover:bg-white/5 text-neutral-300'}`}
                        >
                          <div className="flex items-center gap-1.5 truncate"><FileCode className="w-3 h-3 text-neutral-400 shrink-0" /><span className="truncate">{file.name}</span></div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="text-[10px] text-neutral-500 pt-1 border-t border-white/5">Linked files are explicitly injected and prioritized for code edits.</div>
              </div>
            )}
          </div>
        </div>

        {/* Textarea & Actions */}
        <div className="relative rounded-xl border border-white/[0.08] focus-within:border-sky-500/40 transition-all duration-200 p-2.5"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={linkedFiles.length > 0 ? `Ask Zodiac to edit ${linkedFiles.map(f => f.split('/').pop()).join(', ')}...` : 'Ask Zodiac to inspect, edit, or build...'}
            className="w-full bg-transparent text-xs text-neutral-200 placeholder-neutral-600 outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.06]">
            <span className="text-[9px] text-neutral-600 font-mono">↵ send · ⇧↵ newline</span>
            {isGenerating ? (
              <button
                onClick={handleStop}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold transition-all overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
              >
                <span className="absolute inset-0 rounded-lg animate-ping opacity-20 bg-red-500" />
                <Square className="w-3 h-3 fill-white relative" />
                <span className="relative">Stop</span>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-sky-900/30"
                style={{ background: input.trim() ? 'linear-gradient(135deg, #0284c7 0%, #4f46e5 100%)' : 'rgba(255,255,255,0.06)' }}
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
