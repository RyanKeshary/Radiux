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
  Key,
  ExternalLink,
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
  initialPrompt,
  onClearInitialPrompt,
  files = [],
}: AIAgentPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init_welcome',
      role: 'assistant',
      content:
        'Hello! I am **Zodiac 1.0**, your native AI coding agent. I can inspect your project, search files, run diagnostics, test builds, and propose structured code edits.',
    },
  ]);

  const [input, setInput] = useState('');
  const [permissionMode, setPermissionMode] = useState<AIPermissionMode>('ASSISTED');
  const [isPermissionMenuOpen, setIsPermissionMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-neutral-100">ZODIAC 1.0</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                agent
              </span>
            </div>
            <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
              <span>{activeModel.replace('-versatile', '')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* API Key Config Button */}
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className={`p-1 rounded text-xs transition-colors relative ${
              isKeyConfigured
                ? 'text-neutral-400 hover:text-white hover:bg-white/5'
                : 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10'
            }`}
            title={isKeyConfigured ? 'Groq API Key Configured' : 'Configure Groq API Key'}
          >
            <Key className="w-3.5 h-3.5" />
            {!isKeyConfigured && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          {/* Visitor restriction badge OR Permission Mode Selector */}
          {context.user.role === 'visitor' ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
              Visitor (Read-Only)
            </span>
          ) : (
            <div className="relative" ref={permissionMenuRef}>
              <button
                onClick={() => setIsPermissionMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 border border-white/[0.06] transition-colors"
                title={`Permission Mode: ${permissionMode}`}
              >
                {permissionMode === 'READ_ONLY' && <Shield className="w-2.5 h-2.5 text-neutral-400" />}
                {permissionMode === 'ASSISTED' && <ShieldCheck className="w-2.5 h-2.5 text-sky-400" />}
                {permissionMode === 'AUTONOMOUS' && <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />}
                <span>{permissionMode}</span>
                <ChevronDown className="w-2.5 h-2.5 text-neutral-500" />
              </button>

              {/* State-driven, click-toggled dropdown without hover gaps */}
              {isPermissionMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 rounded-lg bg-neutral-900 border border-white/10 shadow-2xl p-1 z-50 text-xs backdrop-blur-md flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setPermissionMode('READ_ONLY');
                      setIsPermissionMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between text-[11px] cursor-pointer transition-colors ${
                      permissionMode === 'READ_ONLY'
                        ? 'bg-sky-500/20 text-sky-300 font-semibold'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-neutral-400" />
                      <span>READ_ONLY</span>
                    </div>
                    {permissionMode === 'READ_ONLY' && <Check className="w-3 h-3 text-sky-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setPermissionMode('ASSISTED');
                      setIsPermissionMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between text-[11px] cursor-pointer transition-colors ${
                      permissionMode === 'ASSISTED'
                        ? 'bg-sky-500/20 text-sky-300 font-semibold'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                      <span>ASSISTED</span>
                    </div>
                    {permissionMode === 'ASSISTED' && <Check className="w-3 h-3 text-sky-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setPermissionMode('AUTONOMOUS');
                      setIsPermissionMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between text-[11px] cursor-pointer transition-colors ${
                      permissionMode === 'AUTONOMOUS'
                        ? 'bg-sky-500/20 text-sky-300 font-semibold'
                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>AUTONOMOUS</span>
                    </div>
                    {permissionMode === 'AUTONOMOUS' && <Check className="w-3 h-3 text-sky-400" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Project Memory Drawer Button */}
          <button
            onClick={() => setIsMemoryOpen(!isMemoryOpen)}
            className={`p-1 rounded text-xs transition-colors ${
              isMemoryOpen ? 'bg-sky-500/20 text-sky-300' : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title="Project AI Memory & Architecture Rules"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

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
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs select-text">
        {messages.map((m) => {
          const isApiKeyError = m.content.includes('GROQ_API_KEY is not configured');
          return (
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
                    Zodiac 1.0
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
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input Area */}
      <div className="p-3 border-t border-white/10 bg-neutral-900/40 flex flex-col gap-2 relative">
        {/* Context & Target File Linking Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] text-neutral-400 pb-1 scrollbar-none">
          {/* Active editor file chip */}
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

          {/* Linked Target Files Badges (Specially targeted for edit) */}
          {linkedFiles.map((file) => (
            <div
              key={file}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0 font-mono text-[10px] shadow-sm animate-in fade-in zoom-in-95 duration-100"
            >
              <FileCode className="w-2.5 h-2.5 text-sky-400" />
              <span className="font-semibold text-white truncate max-w-[120px]">
                {file.split('/').pop()}
              </span>
              <span className="text-[9px] text-sky-300/80 font-sans">(Target)</span>
              <button
                onClick={() => setLinkedFiles((prev) => prev.filter((f) => f !== file))}
                className="hover:text-red-400 text-sky-300 transition-colors ml-0.5"
                title={`Remove ${file} from target edits`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}

          {/* Git Branch chip */}
          {context.git?.branch && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] shrink-0 font-mono">
              <GitBranch className="w-2.5 h-2.5 text-neutral-400" />
              <span>{context.git.branch}</span>
            </div>
          )}

          {/* Link file to edit (+) Button */}
          <div className="relative shrink-0" ref={filePickerRef}>
            <button
              onClick={() => setIsLinkingFileOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] transition-colors"
              title="Link specific page or file for Zodiac to view and edit"
            >
              <Plus className="w-3 h-3" />
              <span>Link page to edit</span>
            </button>

            {/* Target File Picker Popover */}
            {isLinkingFileOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-72 rounded-xl bg-neutral-900 border border-white/10 shadow-2xl p-2.5 z-50 text-xs backdrop-blur-md flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1 border-b border-white/10">
                  <span className="font-semibold text-neutral-200 text-[11px]">
                    Link Target Page / File
                  </span>
                  <button
                    onClick={() => setIsLinkingFileOpen(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <input
                  type="text"
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  placeholder="Search project files to link..."
                  className="w-full px-2 py-1 rounded bg-neutral-950 border border-white/10 text-neutral-200 text-[11px] focus:outline-none focus:border-sky-500 font-mono"
                  autoFocus
                />

                <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
                  {filteredProjectFiles.length === 0 ? (
                    <div className="text-[11px] text-neutral-500 p-2 text-center">
                      No matching files found
                    </div>
                  ) : (
                    filteredProjectFiles.map((file) => {
                      const isSelected = linkedFiles.includes(file.name);
                      return (
                        <button
                          key={file.id || file.name}
                          onClick={() => {
                            if (isSelected) {
                              setLinkedFiles((prev) => prev.filter((f) => f !== file.name));
                            } else {
                              setLinkedFiles((prev) => [...prev, file.name]);
                            }
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-[11px] font-mono transition-colors ${
                            isSelected
                              ? 'bg-sky-500/20 text-sky-300 font-semibold'
                              : 'hover:bg-white/5 text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="text-[10px] text-neutral-500 pt-1 border-t border-white/5">
                  Linked files are explicitly injected and prioritized for code edits.
                </div>
              </div>
            )}
          </div>
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
            placeholder={
              linkedFiles.length > 0
                ? `Ask Zodiac to edit ${linkedFiles.map((f) => f.split('/').pop()).join(', ')}...`
                : 'Ask AI agent to inspect files, edit code, run terminal...'
            }
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
