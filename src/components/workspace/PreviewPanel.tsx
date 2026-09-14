'use client';

import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/config';
import { 
  RefreshCw, 
  ExternalLink, 
  Globe, 
  AlertCircle, 
  FileCode, 
  Server, 
  ArrowUpRight,
  HelpCircle 
} from 'lucide-react';

interface PreviewPanelProps {
  projectId: string;
  initialPort?: number;
  availablePorts?: number[];
  activeFileName?: string | null;
}

type PreviewMode = 'static' | 'port';

export function PreviewPanel({ 
  projectId, 
  initialPort = 5000, 
  availablePorts = [],
  activeFileName = 'index.html'
}: PreviewPanelProps) {
  const [mode, setMode] = useState<PreviewMode>('static');
  const [port, setPort] = useState<number>(initialPort || 5000);
  const [path, setPath] = useState<string>('/');
  const [key, setKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPortActive, setIsPortActive] = useState<boolean | null>(null);

  // If a port was auto-detected from terminal output, switch to port mode
  useEffect(() => {
    if (availablePorts.length > 0) {
      const latestPort = availablePorts[availablePorts.length - 1];
      setPort(latestPort);
      setMode('port');
      setIsPortActive(true);
    }
  }, [availablePorts]);

  // Check if port is active when in port mode
  useEffect(() => {
    if (mode === 'port') {
      let cancelled = false;
      const checkPort = async () => {
        try {
          const res = await fetch(buildApiUrl('/api/check-port', { port: String(port) }));
          const data = await res.json();
          if (!cancelled) {
            setIsPortActive(data.open);
          }
        } catch (e) {
          if (!cancelled) setIsPortActive(false);
        }
      };

      checkPort();
      const interval = setInterval(checkPort, 3000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [mode, port, key]);

  // Static preview URL points to CodeCollab backend file server
  const staticUrl = buildApiUrl(`/preview/${projectId}/${path.replace(/^\//, '') || 'index.html'}`);
  
  // Port preview URL points to the local listening service (e.g. Express, Flask, Vite)
  const portUrl = `http://localhost:${port}${path.startsWith('/') ? path : '/' + path}`;

  const currentUrl = mode === 'static' ? staticUrl : portUrl;

  const handleReload = () => {
    setIsLoading(true);
    setKey((prev) => prev + 1);
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleOpenExternal = () => {
    window.open(currentUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#181818] overflow-hidden select-none">
      {/* Browser address bar */}
      <div className="h-9 bg-[#252526] border-b border-[#333333] px-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-1 max-w-2xl">
          {/* Mode Switcher: Static HTML vs Running Server */}
          <div className="flex items-center bg-[#1e1e1e] border border-[#3c3c3c] rounded p-0.5 mr-1">
            <button
              onClick={() => {
                setMode('static');
                handleReload();
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                mode === 'static'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Preview static HTML/JS project files directly"
            >
              <FileCode className="w-3 h-3" />
              <span>Static HTML</span>
            </button>
            <button
              onClick={() => {
                setMode('port');
                handleReload();
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                mode === 'port'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Preview app running on a local port (e.g. Node/Express, Python/Flask)"
            >
              <Server className="w-3 h-3" />
              <span>Local Server</span>
            </button>
          </div>

          <button
            onClick={handleReload}
            title="Reload Preview"
            className="p-1 rounded hover:bg-[#333333] text-neutral-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Port Selector (Only visible in port mode) */}
          {mode === 'port' && (
            <div className="flex items-center gap-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-0.5 text-xs">
              <span className="text-neutral-500 font-mono text-[11px]">Port:</span>
              <input
                type="number"
                value={port}
                onChange={(e) => {
                  setPort(Number(e.target.value));
                  setIsPortActive(null);
                }}
                className="w-16 bg-transparent text-white font-mono focus:outline-none text-[11px]"
              />
              <span 
                className={`w-2 h-2 rounded-full ${
                  isPortActive === true 
                    ? 'bg-emerald-400' 
                    : isPortActive === false 
                    ? 'bg-rose-400' 
                    : 'bg-neutral-500'
                }`}
                title={isPortActive ? `Port ${port} is active` : `No server running on port ${port}`}
              />
            </div>
          )}

          {/* Path bar */}
          <div className="flex items-center gap-1.5 flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2.5 py-0.5 text-xs text-neutral-300">
            <Globe className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReload()}
              placeholder={mode === 'static' ? 'index.html' : '/ (Path)'}
              className="w-full bg-transparent text-white focus:outline-none font-mono text-[11px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {availablePorts.length > 0 && mode === 'port' && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-400">
              <span>Detected:</span>
              {availablePorts.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPort(p);
                    handleReload();
                  }}
                  className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                    port === p
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
                  }`}
                >
                  :{p}
                </button>
              ))}
            </div>
          )}

          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${currentUrl} in new browser tab`}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#333333] hover:bg-[#3e3e3e] text-white text-[11px] font-medium transition-colors border border-[#444444] no-underline cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden md:inline">Open in Tab</span>
          </a>
        </div>
      </div>

      {/* Viewport: Either Iframe or helpful guide if local server is down */}
      <div className="flex-1 w-full h-full relative bg-white overflow-hidden">
        {mode === 'port' && isPortActive === false ? (
          <div className="flex flex-col items-center justify-center h-full bg-[#181818] text-[#cccccc] p-6 text-center select-none">
            <div className="max-w-md bg-[#252526] border border-[#3c3c3c] rounded-xl p-6 shadow-xl flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
                <Server className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">
                No Server Listening on Port {port}
              </h3>
              <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                Run a web server in the terminal (for example <code className="text-sky-300 font-mono bg-[#1e1e1e] px-1.5 py-0.5 rounded">node index.js</code> or <code className="text-sky-300 font-mono bg-[#1e1e1e] px-1.5 py-0.5 rounded">python -m http.server {port}</code>), or switch to <strong className="text-emerald-400">Static HTML</strong> mode to preview your HTML files directly.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setMode('static');
                    handleReload();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Switch to Static HTML Preview</span>
                </button>
                <button
                  onClick={handleReload}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#333333] hover:bg-[#3e3e3e] text-white text-xs font-medium transition-colors border border-[#444444]"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Port</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            key={key}
            src={currentUrl}
            title="Web Application Preview"
            className="w-full h-full border-0 bg-white"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          />
        )}
      </div>
    </div>
  );
}
