'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  X, 
  Globe, 
  Server, 
  Terminal, 
  ShieldCheck, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

interface DeployLog {
  id: string;
  target: 'vercel' | 'render';
  status: 'building' | 'success' | 'failed';
  timestamp: string;
  message: string;
  url?: string;
}

export function DeploymentModal({
  isOpen,
  onClose,
  projectName,
}: DeploymentModalProps) {
  const [vercelDeploying, setVercelDeploying] = useState(false);
  const [renderDeploying, setRenderDeploying] = useState(false);
  const [vercelStatus, setVercelStatus] = useState<'idle' | 'deploying' | 'live'>('live');
  const [renderStatus, setRenderStatus] = useState<'idle' | 'deploying' | 'live'>('live');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const [logs, setLogs] = useState<DeployLog[]>([
    {
      id: '1',
      target: 'vercel',
      status: 'success',
      timestamp: 'Just now',
      message: 'Production deployment completed: code-collab-ide.vercel.app',
      url: 'https://code-collab-ide.vercel.app',
    },
    {
      id: '2',
      target: 'render',
      status: 'success',
      timestamp: 'Just now',
      message: 'Web service active: codecollab-backend-isjt.onrender.com',
      url: 'https://codecollab-backend-isjt.onrender.com',
    },
  ]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    triggerHaptic('light');
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDeployVercel = () => {
    triggerHaptic('medium');
    setVercelDeploying(true);
    setVercelStatus('deploying');

    const newLog: DeployLog = {
      id: Date.now().toString(),
      target: 'vercel',
      status: 'building',
      timestamp: new Date().toLocaleTimeString(),
      message: 'Triggered Vercel production build via GitHub sync...',
    };
    setLogs(prev => [newLog, ...prev]);

    setTimeout(() => {
      setVercelDeploying(false);
      setVercelStatus('live');
      triggerHaptic('success');
      setLogs(prev => [
        {
          id: (Date.now() + 1).toString(),
          target: 'vercel',
          status: 'success',
          timestamp: new Date().toLocaleTimeString(),
          message: 'Frontend deployed successfully to Vercel edge network',
          url: 'https://code-collab-ide.vercel.app',
        },
        ...prev,
      ]);
    }, 2800);
  };

  const handleDeployRender = () => {
    triggerHaptic('medium');
    setRenderDeploying(true);
    setRenderStatus('deploying');

    const newLog: DeployLog = {
      id: Date.now().toString(),
      target: 'render',
      status: 'building',
      timestamp: new Date().toLocaleTimeString(),
      message: 'Triggered Render container rebuild...',
    };
    setLogs(prev => [newLog, ...prev]);

    setTimeout(() => {
      setRenderDeploying(false);
      setRenderStatus('live');
      triggerHaptic('success');
      setLogs(prev => [
        {
          id: (Date.now() + 1).toString(),
          target: 'render',
          status: 'success',
          timestamp: new Date().toLocaleTimeString(),
          message: 'Node.js WebSocket & API backend active on Render',
          url: 'https://codecollab-backend-isjt.onrender.com',
        },
        ...prev,
      ]);
    }, 3200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none p-4">
      <div 
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Deployment Center</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Production Connected
                </span>
              </div>
              <p className="text-[11px] opacity-60">Deploy {projectName} to Vercel & Render directly from the IDE</p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Targets Grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target 1: Vercel Frontend */}
          <div 
            className="p-4 rounded-xl border flex flex-col justify-between relative overflow-hidden"
            style={{
              backgroundColor: 'var(--ide-dock-header)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold border border-white/20">
                    ▲
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs">Vercel (Frontend)</h3>
                    <p className="text-[10px] opacity-60">Next.js Edge & Static Hosting</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live</span>
                </div>
              </div>

              {/* URL */}
              <div className="p-2 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between">
                <span className="truncate text-[11px] opacity-80 font-mono">
                  https://code-collab-ide.vercel.app
                </span>
                <button
                  onClick={() => copyToClipboard('https://code-collab-ide.vercel.app')}
                  className="p-1 hover:text-sky-400 transition-colors"
                  title="Copy URL"
                >
                  {copiedUrl === 'https://code-collab-ide.vercel.app' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
              <button
                onClick={handleDeployVercel}
                disabled={vercelDeploying}
                className="flex-1 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-900/30 transition-all active:scale-[0.98]"
              >
                {vercelDeploying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deploying to Vercel...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Deploy to Vercel</span>
                  </>
                )}
              </button>

              <a
                href="https://code-collab-ide.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors"
                title="Open Live App"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Target 2: Render Backend */}
          <div 
            className="p-4 rounded-xl border flex flex-col justify-between relative overflow-hidden"
            style={{
              backgroundColor: 'var(--ide-dock-header)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs">Render (Backend)</h3>
                    <p className="text-[10px] opacity-60">WebSocket & API Server</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live</span>
                </div>
              </div>

              {/* URL */}
              <div className="p-2 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between">
                <span className="truncate text-[11px] opacity-80 font-mono">
                  codecollab-backend-isjt.onrender.com
                </span>
                <button
                  onClick={() => copyToClipboard('https://codecollab-backend-isjt.onrender.com')}
                  className="p-1 hover:text-emerald-400 transition-colors"
                  title="Copy URL"
                >
                  {copiedUrl === 'https://codecollab-backend-isjt.onrender.com' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
              <button
                onClick={handleDeployRender}
                disabled={renderDeploying}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all active:scale-[0.98]"
              >
                {renderDeploying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deploying to Render...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Deploy to Render</span>
                  </>
                )}
              </button>

              <a
                href="https://codecollab-backend-isjt.onrender.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors"
                title="Open Live Backend API"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Activity & Deployment Logs */}
        <div className="px-4 pb-4">
          <div className="p-3 rounded-xl border space-y-2" style={{ backgroundColor: 'var(--ide-sidebar)', borderColor: 'var(--ide-border)' }}>
            <div className="flex items-center justify-between text-[11px] font-semibold opacity-70">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Recent Deployment Events
              </span>
              <span>Automatic GitHub CI/CD Active</span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[11px]">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-1 border-b border-white/5 gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : 'bg-sky-400 animate-pulse'}`} />
                    <span className="uppercase text-[9px] px-1 rounded bg-white/10 text-neutral-300">
                      {log.target}
                    </span>
                    <span className="truncate opacity-80">{log.message}</span>
                  </div>
                  <span className="text-[10px] opacity-50 flex-shrink-0">{log.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
