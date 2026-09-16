'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  ExternalLink, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Terminal, 
  ShieldCheck, 
  Layers, 
  Server, 
  Globe, 
  ArrowUpRight,
  RefreshCw,
  LogOut,
  ChevronRight,
  Activity,
  Play
} from 'lucide-react';

interface DeploymentItem {
  id: string;
  provider: 'vercel' | 'render';
  name: string;
  status: 'ready' | 'building' | 'error' | 'queued' | 'canceled';
  url: string;
  createdAt: string;
  commitMessage?: string;
  branch?: string;
}

interface DeploymentPanelProps {
  projectId: string;
  projectName: string;
  onOpenInBottomPanel?: () => void;
  isBottomPanel?: boolean;
}

export function DeploymentPanel({
  projectId,
  projectName,
  onOpenInBottomPanel,
  isBottomPanel = false,
}: DeploymentPanelProps) {
  const [selectedProvider, setSelectedProvider] = useState<'vercel' | 'render'>('vercel');
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [statusData, setStatusData] = useState<{
    vercel?: { connected: boolean; project?: any; deployments?: DeploymentItem[]; error?: string };
    render?: { connected: boolean; services?: any[]; deployments?: DeploymentItem[]; error?: string };
  }>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<DeploymentItem | null>(null);

  // Fetch status from secure API
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deploy');
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
      }
    } catch (err: any) {
      console.error('[DeploymentPanel] Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Trigger deployment
  const handleDeploy = async (clearCache = false) => {
    setDeploying(true);
    setFeedback({ type: 'info', message: `Triggering deployment on ${selectedProvider.toUpperCase()}...` });
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          action: 'deploy',
          clearCache,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          message: data.message || `Deployment queued on ${selectedProvider.toUpperCase()}!`,
        });
        await fetchStatus();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Deployment failed to trigger. Check configuration.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Network error triggering deployment' });
    } finally {
      setDeploying(false);
    }
  };

  const currentStatus = selectedProvider === 'vercel' ? statusData.vercel : statusData.render;
  const isConnected = !!currentStatus?.connected;
  const deployments = currentStatus?.deployments || [];
  const latestDeploy = deployments[0];

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs" style={{ color: 'var(--ide-text)' }}>
      {/* Header Tabs */}
      <div 
        className="p-3 border-b flex items-center justify-between gap-2"
        style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-sidebar-bg)' }}
      >
        <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-black/20 border border-white/5">
          <button
            onClick={() => setSelectedProvider('vercel')}
            className={`px-3 py-1 rounded-md font-medium text-[11px] transition-all flex items-center gap-1.5 ${
              selectedProvider === 'vercel'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'opacity-70 hover:opacity-100 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Vercel (Frontend)</span>
          </button>
          <button
            onClick={() => setSelectedProvider('render')}
            className={`px-3 py-1 rounded-md font-medium text-[11px] transition-all flex items-center gap-1.5 ${
              selectedProvider === 'render'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'opacity-70 hover:opacity-100 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Render (Backend)</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 transition-colors"
            title="Refresh deployment status"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div 
          className={`px-3 py-2 text-[11px] flex items-center justify-between border-b ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' 
              : feedback.type === 'error'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/20'
              : 'bg-sky-500/15 text-sky-300 border-sky-500/20'
          }`}
        >
          <span className="truncate">{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 ml-2">×</button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status Card */}
        <div 
          className="p-3.5 rounded-xl border relative overflow-hidden backdrop-blur-md"
          style={{ 
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)'
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">
                  {selectedProvider === 'vercel' ? 'Vercel Deployment' : 'Render Web Service'}
                </span>
                <span 
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {isConnected ? 'Connected' : 'Setup Required'}
                </span>
              </div>
              <p className="text-[11px] opacity-60">
                {selectedProvider === 'vercel' 
                  ? 'Production Next.js application & Edge routing' 
                  : 'Node.js server, WebSockets & terminal/Git daemon'}
              </p>
            </div>

            {selectedProvider === 'vercel' ? (
              <Globe className="w-8 h-8 opacity-20 text-sky-400" />
            ) : (
              <Server className="w-8 h-8 opacity-20 text-purple-400" />
            )}
          </div>

          {/* Connection Details or Error */}
          {isConnected ? (
            <div className="mt-3.5 pt-3 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="opacity-60">Production URL:</span>
                <a 
                  href={
                    selectedProvider === 'vercel' 
                      ? 'https://code-collab-ide.vercel.app' 
                      : 'https://codecollab-backend-isjt.onrender.com'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1 font-mono font-medium"
                >
                  <span>
                    {selectedProvider === 'vercel' 
                      ? 'code-collab-ide.vercel.app' 
                      : 'codecollab-backend-isjt.onrender.com'}
                  </span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="opacity-60">Environment:</span>
                <span className="font-mono text-emerald-400">Production (Live)</span>
              </div>

              {latestDeploy && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="opacity-60">Latest Status:</span>
                  <span className="flex items-center gap-1 font-medium capitalize">
                    {latestDeploy.status === 'ready' ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    ) : latestDeploy.status === 'building' ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" /> Building...
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Error
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-[11px] text-amber-300 mb-2">
                {currentStatus?.error || 'Provider credentials need configuration in server environment.'}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => handleDeploy(false)}
              disabled={deploying}
              className="flex-1 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{deploying ? 'Deploying...' : `Deploy to ${selectedProvider === 'vercel' ? 'Vercel' : 'Render'}`}</span>
            </button>

            {selectedProvider === 'render' && (
              <button
                onClick={() => handleDeploy(true)}
                disabled={deploying}
                title="Clear build cache and deploy fresh"
                className="py-2 px-3 rounded-lg border border-white/10 hover:bg-white/5 opacity-80 hover:opacity-100 text-[11px] transition-colors"
              >
                Clear Cache & Deploy
              </button>
            )}
          </div>
        </div>

        {/* Deployment History */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-[11px] uppercase tracking-wider opacity-60">
              Recent Deployments ({deployments.length})
            </h4>
            <span className="text-[10px] opacity-40 font-mono">Auto-syncs with Git</span>
          </div>

          {deployments.length === 0 ? (
            <div 
              className="p-6 text-center rounded-xl border border-dashed text-neutral-400 text-xs"
              style={{ borderColor: 'var(--ide-border)' }}
            >
              <Cloud className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="font-medium">No deployment history found</p>
              <p className="text-[11px] opacity-60 mt-0.5">
                Trigger a deployment above to publish this project.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {deployments.map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 rounded-lg border transition-colors hover:border-sky-500/40 flex items-center justify-between gap-3 group"
                  style={{ 
                    backgroundColor: 'var(--ide-card-bg)', 
                    borderColor: 'var(--ide-border)' 
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span 
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          d.status === 'ready' 
                            ? 'bg-emerald-400' 
                            : d.status === 'building' 
                            ? 'bg-amber-400 animate-pulse' 
                            : 'bg-rose-400'
                        }`} 
                      />
                      <span className="font-semibold text-xs truncate">
                        {d.commitMessage || d.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[10.5px] opacity-60 font-mono">
                      <span>branch: {d.branch || 'main'}</span>
                      <span>{new Date(d.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 text-sky-400"
                      title="Open deployment"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
