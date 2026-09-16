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

  // Static preview URL points to Radiux backend file server
  const staticUrl = buildApiUrl(`/preview/${projectId}/${path.replace(/^\//, '') || 'index.html'}`);
  
  // Port preview URL points through the backend reverse proxy so remote clients can access dev servers running on Render
  const portUrl = buildApiUrl(`/proxy/${port}${path.startsWith('/') ? path : '/' + path}`);

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
    <div
      style={{
        backgroundColor: 'var(--ide-bg)',
        color: 'var(--ide-text)',
      }}
      className="flex flex-col h-full w-full overflow-hidden select-none"
    >
      {/* Browser address bar */}
      <div
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="h-9 border-b px-3 flex items-center justify-between gap-2 text-xs"
      >
        <div className="flex items-center gap-1.5 flex-1 max-w-2xl">
          {/* Mode Switcher: Static HTML vs Running Server */}
          <div
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
            }}
            className="flex items-center border rounded p-0.5 mr-1"
          >
            <button
              onClick={() => {
                setMode('static');
                handleReload();
              }}
              style={{
                color: mode === 'static' ? '#ffffff' : 'var(--ide-text-muted)',
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                mode === 'static'
                  ? 'bg-emerald-600 shadow-sm'
                  : 'hover:opacity-80'
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
              style={{
                color: mode === 'port' ? '#ffffff' : 'var(--ide-text-muted)',
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                mode === 'port'
                  ? 'bg-sky-600 shadow-sm'
                  : 'hover:opacity-80'
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
            style={{ color: 'var(--ide-text-muted)' }}
            className="p-1 rounded hover:opacity-80 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Port Selector (Only visible in port mode) */}
          {mode === 'port' && (
            <div
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
              }}
              className="flex items-center gap-1 border rounded px-2 py-0.5 text-xs"
            >
              <span className="font-mono text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>Port:</span>
              <input
                type="number"
                value={port}
                onChange={(e) => {
                  setPort(Number(e.target.value));
                  setIsPortActive(null);
                }}
                style={{ color: 'var(--ide-text)' }}
                className="w-16 bg-transparent font-mono focus:outline-none text-[11px]"
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
          <div
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
            className="flex items-center gap-1.5 flex-1 border rounded px-2.5 py-0.5 text-xs"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReload()}
              placeholder={mode === 'static' ? 'index.html' : '/ (Path)'}
              style={{ color: 'var(--ide-text)' }}
              className="w-full bg-transparent focus:outline-none font-mono text-[11px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {availablePorts.length > 0 && mode === 'port' && (
            <div className="hidden sm:flex items-center gap-1 text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
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
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors border no-underline cursor-pointer hover:opacity-90"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden md:inline">Open in Tab</span>
          </a>
        </div>
      </div>

      {/* Viewport: Either Iframe or helpful guide if local server is down */}
      <div className="flex-1 w-full h-full relative bg-white overflow-hidden">
        {mode === 'port' && isPortActive === false ? (
          <div
            style={{
              backgroundColor: 'var(--ide-bg)',
              color: 'var(--ide-text)',
            }}
            className="flex flex-col items-center justify-center h-full p-6 text-center select-none"
          >
            <div
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
              }}
              className="max-w-md border rounded-xl p-6 shadow-xl flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
                <Server className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ide-text)' }}>
                No Server Listening on Port {port}
              </h3>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--ide-text-muted)' }}>
                Run a web server in the terminal (for example <code className="text-sky-400 font-mono px-1.5 py-0.5 rounded border" style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}>node index.js</code> or <code className="text-sky-400 font-mono px-1.5 py-0.5 rounded border" style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}>python -m http.server {port}</code>), or switch to <strong className="text-emerald-400">Static HTML</strong> mode to preview your HTML files directly.
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
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border hover:opacity-90"
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
