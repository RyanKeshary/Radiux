'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { config } from '@/lib/config';
import { 
  Square, 
  RotateCcw, 
  Trash2, 
  Terminal as TerminalIcon, 
  Clipboard, 
  Plus, 
  ChevronDown, 
  X, 
  Play, 
  Columns, 
  Maximize2, 
  Minimize2,
  Check,
  Edit2
} from 'lucide-react';

interface TerminalProfile {
  id: string;
  name: string;
  executable: string;
  args: string[];
  icon?: string;
  platform: string;
  available: boolean;
  isDefault: boolean;
}

interface TerminalSessionState {
  id: string;
  title: string;
  profileId: string;
  status: 'starting' | 'running' | 'exited' | 'stopping';
  pid?: number | null;
  detectedPorts?: number[];
}

interface TerminalPanelProps {
  projectId: string;
  onPortDetected?: (port: number) => void;
  activeFileName?: string | null;
  theme?: string;
}

const TERMINAL_THEMES: Record<string, any> = {
  dark: {
    background: '#181818',
    foreground: '#d4d4d4',
    cursor: '#007acc',
    cursorAccent: '#ffffff',
    selectionBackground: 'rgba(9, 71, 113, 0.6)',
  },
  light: {
    background: '#f9fafb',
    foreground: '#1f2937',
    cursor: '#0284c7',
    cursorAccent: '#ffffff',
    selectionBackground: 'rgba(2, 132, 199, 0.25)',
  },
  midnight: {
    background: '#07090e',
    foreground: '#e2e8f0',
    cursor: '#38bdf8',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(56, 189, 248, 0.3)',
  },
  dracula: {
    background: '#1e1f29',
    foreground: '#f8f8f2',
    cursor: '#bd93f9',
    cursorAccent: '#282a36',
    selectionBackground: 'rgba(189, 147, 249, 0.3)',
  },
  monokai: {
    background: '#1b1c18',
    foreground: '#f8f8f2',
    cursor: '#e6db74',
    cursorAccent: '#272822',
    selectionBackground: 'rgba(230, 219, 116, 0.3)',
  },
  nord: {
    background: '#232731',
    foreground: '#eceff4',
    cursor: '#88c0d0',
    cursorAccent: '#2e3440',
    selectionBackground: 'rgba(136, 192, 208, 0.3)',
  },
  solarized: {
    background: '#001c24',
    foreground: '#93a1a1',
    cursor: '#2aa198',
    cursorAccent: '#002b36',
    selectionBackground: 'rgba(42, 161, 152, 0.3)',
  },
  'high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#f38518',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(243, 133, 24, 0.4)',
  },
};

export function TerminalPanel({ projectId, onPortDetected, activeFileName, theme = 'dark' }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Multi-session state
  const [sessions, setSessions] = useState<TerminalSessionState[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [availableProfiles, setAvailableProfiles] = useState<TerminalProfile[]>([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isShellSelectorOpen, setIsShellSelectorOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  // Connection and process state for active session
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [detectedPorts, setDetectedPorts] = useState<number[]>([]);
  const [splitView, setSplitView] = useState(false);
  const [secondarySessionId, setSecondarySessionId] = useState<string | null>(null);

  // References to keep active xterm & ws instances alive across session switching
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<any>(null);

  // Fetch host terminal profiles on mount
  useEffect(() => {
    let isMounted = true;
    const fetchProfiles = async () => {
      try {
        const res = await fetch(config.buildApiUrl('/api/terminal/profiles'));
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.profiles)) {
            setAvailableProfiles(data.profiles);
          }
        }
      } catch (e) {}
    };
    fetchProfiles();
    return () => { isMounted = false; };
  }, []);

  // Update theme dynamically
  useEffect(() => {
    if (xtermRef.current) {
      const termTheme = TERMINAL_THEMES[theme] || TERMINAL_THEMES.dark;
      xtermRef.current.options.theme = {
        ...xtermRef.current.options.theme,
        ...termTheme,
      };
    }
  }, [theme]);

  // Connect or switch pseudo-terminal session
  const connectToSession = useCallback((sessionId: string, profileId?: string) => {
    if (!containerRef.current) return;

    // Clean up previous socket if any
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clean up previous xterm instance if any
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }

    setConnectionStatus('connecting');

    const termTheme = TERMINAL_THEMES[theme] || TERMINAL_THEMES.dark;
    const term = new XTerm({
      theme: {
        ...termTheme,
        black: '#1e1e1e',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#38bdf8',
        magenta: '#c084fc',
        cyan: '#2dd4bf',
        white: '#ffffff',
      },
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 10000,
      convertEol: false,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;36m[Radiux IDE Terminal]\x1b[0m Initializing PTY process session...');

    const sendResize = (ws: WebSocket) => {
      if (ws.readyState === WebSocket.OPEN && term.cols && term.rows) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    const wsUrl = config.buildWsUrl('/terminal', {
      projectId,
      sessionId: sessionId || '',
      profileId: profileId || '',
      cols: String(term.cols || 80),
      rows: String(term.rows || 24),
    });

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCountRef.current = 0;
      setConnectionStatus('connected');
      try {
        fitAddon.fit();
        sendResize(ws);
      } catch (e) {}
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'init') {
          setActiveSessionId(payload.sessionId);
          if (payload.availableProfiles) {
            setAvailableProfiles(payload.availableProfiles);
          }
          if (Array.isArray(payload.sessions)) {
            setSessions(payload.sessions);
          } else {
            setSessions((prev) => {
              if (prev.some(s => s.id === payload.sessionId)) {
                return prev.map(s => s.id === payload.sessionId ? { ...s, title: payload.title, profileId: payload.profileId } : s);
              }
              return [...prev, {
                id: payload.sessionId,
                title: payload.title || 'Terminal',
                profileId: payload.profileId || 'default',
                status: payload.running ? 'running' : 'exited',
                pid: payload.pid,
              }];
            });
          }

          if (payload.history) {
            term.write(payload.history);
          }

          if (Array.isArray(payload.ports)) {
            setDetectedPorts(payload.ports);
            if (payload.ports.length > 0 && onPortDetected) {
              onPortDetected(payload.ports[payload.ports.length - 1]);
            }
          }
        } else if (payload.type === 'output') {
          if (payload.sessionId === sessionId || !payload.sessionId) {
            term.write(payload.data);
          }
        } else if (payload.type === 'status') {
          setSessions((prev) => prev.map(s => {
            if (s.id === (payload.sessionId || sessionId)) {
              return { ...s, status: payload.running ? 'running' : 'exited', pid: payload.pid };
            }
            return s;
          }));
        } else if (payload.type === 'port_detected') {
          setDetectedPorts((prev) => Array.from(new Set([...prev, payload.port])));
          term.writeln(`\r\n\x1b[1;35m[Server Detected]\x1b[0m Listening on port \x1b[1m${payload.port}\x1b[0m\r\n`);
          if (onPortDetected) onPortDetected(payload.port);
        } else if (payload.type === 'exit') {
          setSessions((prev) => prev.map(s => {
            if (s.id === (payload.sessionId || sessionId)) {
              return { ...s, status: 'exited' };
            }
            return s;
          }));
          term.writeln(`\r\n\x1b[1;33m[Process Exited (code ${payload.code})]\x1b[0m`);
        } else if (payload.type === 'session_renamed') {
          setSessions((prev) => prev.map(s => s.id === payload.sessionId ? { ...s, title: payload.title } : s));
        } else if (payload.type === 'session_updated') {
          setSessions((prev) => prev.map(s => {
            if (s.id === payload.sessionId) {
              return {
                ...s,
                title: payload.title || s.title,
                profileId: payload.profileId || s.profileId,
                status: payload.running ? 'running' : s.status,
                pid: payload.pid,
              };
            }
            return s;
          }));
        } else if (payload.type === 'session_closed') {
          setSessions((prev) => prev.filter(s => s.id !== payload.sessionId));
        }
      } catch (err) {
        term.write(event.data);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      term.writeln('\r\n\x1b[1;31m[Connection Error]\x1b[0m Could not connect to terminal daemon.');
    };

    ws.onclose = () => {
      setConnectionStatus('error');
      if (retryCountRef.current < 4) {
        retryCountRef.current += 1;
        const delay = Math.min(retryCountRef.current * 1500, 6000);
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          connectToSession(sessionId, profileId);
        }, delay);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

  }, [projectId, theme, onPortDetected]);

  // Initial connection on mount
  useEffect(() => {
    connectToSession(activeSessionId);

    const containerEl = containerRef.current;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
          }
        }).catch(() => {});
      }
    };

    if (containerEl) {
      containerEl.addEventListener('keydown', handleKeyDown);
    }

    const handleResize = () => {
      try {
        fitAddonRef.current?.fit();
        if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          }));
        }
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerEl) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          handleResize();
        });
      });
      resizeObserver.observe(containerEl);
      if (containerEl.parentElement) {
        resizeObserver.observe(containerEl.parentElement);
      }
    }

    return () => {
      clearTimeout(retryTimerRef.current);
      if (containerEl) {
        containerEl.removeEventListener('keydown', handleKeyDown);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) wsRef.current.close();
      if (xtermRef.current) xtermRef.current.dispose();
    };
  }, [projectId]);

  const handleCreateSession = (profileId?: string) => {
    const newSessionId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setIsProfileMenuOpen(false);
    setActiveSessionId(newSessionId);
    connectToSession(newSessionId, profileId);
  };

  const handleSwitchSession = (sid: string) => {
    if (sid === activeSessionId) return;
    setActiveSessionId(sid);
    connectToSession(sid);
  };

  const handleCloseSession = (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'kill' }));
    }

    fetch(config.buildApiUrl('/api/terminal/sessions', { projectId, sessionId: sid }), {
      method: 'DELETE',
    }).catch(() => {});

    setSessions((prev) => {
      const filtered = prev.filter(s => s.id !== sid);
      if (sid === activeSessionId && filtered.length > 0) {
        setActiveSessionId(filtered[0].id);
        connectToSession(filtered[0].id);
      } else if (filtered.length === 0) {
        handleCreateSession();
      }
      return filtered;
    });
  };

  const handleRenameSession = (sid: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setSessions((prev) => prev.map(s => s.id === sid ? { ...s, title: newTitle.trim() } : s));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'rename', title: newTitle.trim() }));
    }
    setEditingSessionId(null);
  };

  const handleKill = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'kill' }));
    }
  };

  const handleRestart = (profileId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      xtermRef.current?.clear();
      xtermRef.current?.writeln('\x1b[1;33m[Restarting PTY Session...]\x1b[0m');
      wsRef.current.send(JSON.stringify({ type: 'restart', profileId }));
    } else {
      connectToSession(activeSessionId, profileId);
    }
  };

  const handleClear = () => {
    xtermRef.current?.clear();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
      }
    } catch (e) {}
  };

  const handleRunCommand = (cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data: `${cmd}\r` }));
    } else {
      xtermRef.current?.writeln(`\r\n\x1b[33m[Terminal] Executing command: "${cmd}"\x1b[0m`);
      config.wakeUpBackend();
      connectToSession(activeSessionId);
    }
  };

  const getRunCommandForFile = () => {
    if (!activeFileName) return null;
    const lower = activeFileName.toLowerCase();
    if (lower.endsWith('.py')) {
      return { label: `Run Python (${activeFileName})`, cmd: `python "${activeFileName}"`, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    }
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
      return { label: `Run Node (${activeFileName})`, cmd: `node "${activeFileName}"`, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
    }
    if (lower.endsWith('.ts')) {
      return { label: `Run TS (${activeFileName})`, cmd: `node "${activeFileName}"`, color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' };
    }
    if (lower.endsWith('.sh')) {
      return { label: `Run Bash (${activeFileName})`, cmd: `bash "${activeFileName}"`, color: 'text-neutral-300 border-neutral-700 bg-neutral-800' };
    }
    return null;
  };

  const activeRunAction = getRunCommandForFile();
  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  return (
    <div 
      className="flex flex-col h-full w-full overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* VS Code Style Multi-Session Terminal Tab Bar */}
      <div 
        className="h-8 border-b px-2 flex items-center justify-between text-xs flex-shrink-0"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Left: Terminal Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[65%]">
          {sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            const isEditing = editingSessionId === sess.id;

            return (
              <div
                key={sess.id}
                onClick={() => handleSwitchSession(sess.id)}
                onDoubleClick={() => {
                  setEditingSessionId(sess.id);
                  setEditingTitle(sess.title);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer transition-all text-[11px] group relative ${
                  isActive 
                    ? 'bg-neutral-800/90 text-white font-medium shadow-sm border border-neutral-700/60' 
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
                title="Click to switch terminal | Double-click to rename"
              >
                <TerminalIcon className={`w-3 h-3 ${isActive ? 'text-sky-400' : 'text-neutral-500'}`} />

                {isEditing ? (
                  <input
                    type="text"
                    value={editingTitle}
                    autoFocus
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleRenameSession(sess.id, editingTitle)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSession(sess.id, editingTitle);
                      if (e.key === 'Escape') setEditingSessionId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-neutral-900 border border-sky-500 rounded px-1 py-0 text-white text-[11px] outline-none w-24"
                  />
                ) : (
                  <span className="truncate max-w-[120px]">{sess.title}</span>
                )}

                {sess.status === 'running' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Running" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" title="Exited" />
                )}

                {sessions.length > 1 && (
                  <button
                    onClick={(e) => handleCloseSession(sess.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 rounded p-0.5 transition-opacity"
                    title="Kill Terminal"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* New Terminal Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => {
                setIsProfileMenuOpen(prev => !prev);
                setIsShellSelectorOpen(false);
              }}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="New Terminal Tab (Select Profile)"
            >
              <Plus className="w-3.5 h-3.5" />
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {isProfileMenuOpen && (
              <div 
                className="absolute left-0 top-full mt-1 w-48 rounded-md shadow-2xl border py-1 z-50 animate-in fade-in-50 zoom-in-95 duration-100"
                style={{
                  backgroundColor: 'var(--ide-card-bg)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                  New Terminal Profile
                </div>
                {availableProfiles.filter(p => p.available).length > 0 ? (
                  availableProfiles.filter(p => p.available).map((prof) => (
                    <button
                      key={prof.id}
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleCreateSession(prof.id);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-sky-500/20 hover:text-white flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <TerminalIcon className="w-3 h-3 text-sky-400 group-hover:scale-110 transition-transform" />
                        <span>{prof.name}</span>
                      </div>
                      {prof.isDefault && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-400">Default</span>
                      )}
                    </button>
                  ))
                ) : (
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleCreateSession();
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-sky-500/20 flex items-center gap-2 cursor-pointer"
                  >
                    <TerminalIcon className="w-3 h-3 text-sky-400" />
                    <span>Default Shell</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dedicated Shell / Profile Switcher for Current Session (Requirement 3C) */}
          <div className="relative ml-1">
            <button
              onClick={() => {
                setIsShellSelectorOpen(prev => !prev);
                setIsProfileMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border border-neutral-700/80 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-xs"
              title="Switch Active Shell for this Terminal Session (restarts PTY with selected shell)"
            >
              <TerminalIcon className="w-3 h-3 text-sky-400" />
              <span>Shell: {availableProfiles.find(p => p.id === currentSession?.profileId)?.name || 'PowerShell'}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {isShellSelectorOpen && (
              <div 
                className="absolute left-0 top-full mt-1 w-56 rounded-md shadow-2xl border py-1 z-50 animate-in fade-in-50 zoom-in-95 duration-100"
                style={{
                  backgroundColor: 'var(--ide-card-bg)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 mb-1">
                  Switch Shell (Restarts PTY)
                </div>
                {availableProfiles.filter(p => p.available).length > 0 ? (
                  availableProfiles.filter(p => p.available).map((prof) => {
                    const isCurrent = prof.id === (currentSession?.profileId || (availableProfiles.find(p => p.isDefault)?.id));
                    return (
                      <button
                        key={prof.id}
                        onClick={() => {
                          setIsShellSelectorOpen(false);
                          handleRestart(prof.id);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between group transition-colors cursor-pointer ${
                          isCurrent 
                            ? 'bg-sky-500/20 text-sky-300 font-semibold' 
                            : 'text-neutral-200 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <TerminalIcon className={`w-3 h-3 ${isCurrent ? 'text-sky-400' : 'text-neutral-400 group-hover:text-neutral-200'}`} />
                          <span>{prof.name}</span>
                        </div>
                        {isCurrent && (
                          <Check className="w-3 h-3 text-sky-400" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-2.5 py-1.5 text-xs text-neutral-400">
                    No other shells available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Active File Run button */}
          {activeRunAction && (
            <button
              onClick={() => handleRunCommand(activeRunAction.cmd)}
              title={activeRunAction.label}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border transition-colors ${activeRunAction.color}`}
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span className="hidden sm:inline">{activeRunAction.label}</span>
            </button>
          )}

          <button
            onClick={handlePaste}
            title="Paste Clipboard (Ctrl+V)"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors text-[11px]"
          >
            <Clipboard className="w-3 h-3" />
            <span className="hidden md:inline">Paste</span>
          </button>

          <button
            onClick={handleKill}
            title="Send SIGINT / Stop Running Process (Ctrl+C)"
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-300 transition-colors text-[11px]"
          >
            <Square className="w-3 h-3" />
            <span className="hidden md:inline">Stop (Ctrl+C)</span>
          </button>

          <button
            onClick={() => handleRestart()}
            title="Restart Terminal Session"
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            onClick={handleClear}
            title="Clear Terminal (Ctrl+L)"
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport Container */}
      <div 
        ref={containerRef} 
        onContextMenu={(e) => {
          e.preventDefault();
          handlePaste();
        }}
        style={{ padding: '4px' }}
        className="flex-1 w-full min-h-0 overflow-hidden cursor-text" 
      />
    </div>
  );
}
