'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { config } from '@/lib/config';
import { Square, RotateCcw, Trash2, Terminal as TerminalIcon, Copy, Clipboard } from 'lucide-react';

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
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [processPid, setProcessPid] = useState<number | null>(null);
  const [detectedPorts, setDetectedPorts] = useState<number[]>([]);

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

  useEffect(() => {
    if (!containerRef.current) return;

    const termTheme = TERMINAL_THEMES[theme] || TERMINAL_THEMES.dark;

    // 1. Initialize xterm.js with full ANSI colors and cursor settings
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
      scrollback: 5000,
      convertEol: false, // node-pty handles CRLF properly
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    
    // Slight delay before first fit to ensure DOM has rendered width/height
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    }, 100);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;36m[CodeCollab Remote Terminal]\x1b[0m Connecting to workspace environment...');

    // 2. Connect to terminal WebSocket using centralized config URL
    const wsUrl = config.buildWsUrl('/terminal', { projectId });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN && term.cols && term.rows) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.onopen = () => {
      term.writeln('\x1b[1;32m[Connected]\x1b[0m Workspace shell ready (\x1b[36mNode.js\x1b[0m + \x1b[33mPython 3.12\x1b[0m).');
      term.writeln('\x1b[90mTip: To execute scripts, run \x1b[33mpython <filename>.py\x1b[90m or \x1b[36mnode <filename>.js\x1b[0m');
      term.writeln('');
      try {
        fitAddon.fit();
        sendResize();
      } catch (e) {}
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output') {
          term.write(payload.data);
        } else if (payload.type === 'status') {
          setIsRunning(payload.running);
          if (payload.pid) setProcessPid(payload.pid);
          if (Array.isArray(payload.ports)) {
            setDetectedPorts(payload.ports);
            if (payload.ports.length > 0 && onPortDetected) {
              onPortDetected(payload.ports[payload.ports.length - 1]);
            }
          }
        } else if (payload.type === 'port_detected') {
          setDetectedPorts((prev) => Array.from(new Set([...prev, payload.port])));
          term.writeln(`\r\n\x1b[1;35m[Web Server Detected]\x1b[0m App listening on port \x1b[1m${payload.port}\x1b[0m (Opening Preview tab)\r\n`);
          if (onPortDetected) onPortDetected(payload.port);
        } else if (payload.type === 'exit') {
          setIsRunning(false);
          term.writeln(`\r\n\x1b[1;33m[Process Exited with code ${payload.code}]\x1b[0m`);
        }
      } catch (err) {
        term.write(event.data);
      }
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[1;31m[Connection Error]\x1b[0m Could not connect to remote terminal server.');
    };

    // User typing input to terminal (forwards keystrokes directly to PTY)
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle Ctrl+C, Ctrl+V, right-click paste
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow browser Ctrl+V to paste into xterm
      if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data: text }));
          }
        }).catch(() => {});
      }
    };

    const containerEl = containerRef.current;
    if (containerEl) {
      containerEl.addEventListener('keydown', handleKeyDown);
    }

    const handleResize = () => {
      try {
        fitAddon.fit();
        sendResize();
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);

    // Watch container DOM node with ResizeObserver so maximize, dock resize, or tab switches immediately refit
    // Double rAF ensures that fullscreen transitions fully paint before measuring dimensions
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerEl) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            handleResize();
          });
        });
      });
      resizeObserver.observe(containerEl);
      // Also observe the parent so fullscreen/dock resizes are caught
      if (containerEl.parentElement) {
        resizeObserver.observe(containerEl.parentElement);
      }
    }

    return () => {
      if (containerEl) {
        containerEl.removeEventListener('keydown', handleKeyDown);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [projectId]);

  const handleKill = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'kill' }));
    }
  };

  const handleRestart = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      xtermRef.current?.clear();
      xtermRef.current?.writeln('\x1b[1;33m[Restarting Shell Session...]\x1b[0m');
      wsRef.current.send(JSON.stringify({ type: 'restart' }));
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

  return (
    <div 
      className="flex flex-col h-full w-full overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Terminal Toolbar */}
      <div 
        className="h-7 border-b px-3 flex items-center justify-between text-xs"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold" style={{ color: 'var(--ide-text)' }}>Terminal (node + python)</span>
          {isRunning ? (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              RUNNING {processPid ? `(PID: ${processPid})` : ''}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-700 text-neutral-300">
              IDLE
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Context-aware Run button based on active file */}
          {activeFileName && activeFileName.endsWith('.py') ? (
            <button
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'input', data: `python "${activeFileName}"\r` }));
                }
              }}
              title={`Run python "${activeFileName}"`}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors text-[11px] font-mono font-medium border border-amber-500/30"
            >
              <span>▶ python {activeFileName}</span>
            </button>
          ) : activeFileName && (activeFileName.endsWith('.js') || activeFileName.endsWith('.mjs')) ? (
            <button
              onClick={() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'input', data: `node "${activeFileName}"\r` }));
                }
              }}
              title={`Run node "${activeFileName}"`}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 transition-colors text-[11px] font-mono font-medium border border-emerald-500/30"
            >
              <span>▶ node {activeFileName}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'input', data: 'node index.js\r' }));
                  }
                }}
                title="Run node index.js"
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 transition-colors text-[11px] font-mono"
              >
                <span>▶ node index.js</span>
              </button>

              <button
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'input', data: 'python main.py\r' }));
                  }
                }}
                title="Run python main.py"
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors text-[11px] font-mono"
              >
                <span>▶ python main.py</span>
              </button>
            </>
          )}

          <button
            onClick={handlePaste}
            title="Paste Clipboard (Ctrl+V)"
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#333333] text-neutral-400 hover:text-white transition-colors text-[11px]"
          >
            <Clipboard className="w-3 h-3" />
            <span className="hidden sm:inline">Paste</span>
          </button>

          <button
            onClick={handleKill}
            title="Send SIGINT / Stop Running Process (Ctrl+C)"
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-500/20 hover:text-rose-300 text-neutral-400 transition-colors text-[11px]"
          >
            <Square className="w-3 h-3" />
            <span className="hidden sm:inline">Stop (Ctrl+C)</span>
          </button>

          <button
            onClick={handleRestart}
            title="Restart Terminal Session"
            className="p-1 rounded hover:bg-[#333333] hover:text-white text-neutral-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            onClick={handleClear}
            title="Clear Terminal"
            className="p-1 rounded hover:bg-[#333333] hover:text-white text-neutral-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport — must be position:relative with explicit 0 padding for xterm to measure correctly */}
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
