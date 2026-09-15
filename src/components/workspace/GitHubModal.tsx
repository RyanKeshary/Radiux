'use client';

import React, { useState, useEffect } from 'react';
import { 
  Github, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  Lock,
  RefreshCw,
  Unlink
} from 'lucide-react';
import { DataService } from '@/lib/data-service';
import { GitHubRemote } from '@/lib/types';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  currentBranch: string;
  onSyncComplete?: () => void;
}

export function GitHubModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentBranch,
  onSyncComplete,
}: GitHubModalProps) {
  const [remotes, setRemotes] = useState<GitHubRemote[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRemotes();
      setMessage(null);
    }
  }, [isOpen, projectId]);

  const loadRemotes = async () => {
    setLoading(true);
    try {
      const list = await DataService.getGitHubRemotes(projectId);
      setRemotes(list);
      const origin = list.find(r => r.name === 'origin');
      if (origin) {
        setRepoUrl(origin.url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setLoading(true);
    setMessage(null);
    try {
      const res = await DataService.setGitHubRemote(projectId, repoUrl.trim());
      if (res.success) {
        setMessage({ type: 'success', text: 'GitHub repository linked successfully.' });
        await loadRemotes();
      } else {
        setMessage({ type: 'error', text: res.stderr || 'Failed to link repository' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Connection error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await DataService.disconnectGitHubRemote(projectId, 'origin');
      if (res.success) {
        setMessage({ type: 'success', text: 'GitHub repository disconnected.' });
        setRepoUrl('');
        await loadRemotes();
      } else {
        setMessage({ type: 'error', text: res.stderr || 'Failed to disconnect repository' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    setSyncing('push');
    setMessage(null);
    try {
      const res = await DataService.pushToGitHub(projectId, currentBranch, token);
      if (res.success) {
        setMessage({ type: 'success', text: `Successfully pushed branch '${currentBranch}' to GitHub!` });
        if (onSyncComplete) onSyncComplete();
      } else {
        setMessage({ type: 'error', text: res.stderr || 'Push failed. Please check branch or GitHub token.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error pushing commits' });
    } finally {
      setSyncing(null);
    }
  };

  const handlePull = async () => {
    setSyncing('pull');
    setMessage(null);
    try {
      const res = await DataService.pullFromGitHub(projectId, currentBranch, token);
      if (res.success) {
        setMessage({ type: 'success', text: `Successfully pulled changes from GitHub for '${currentBranch}'!` });
        if (onSyncComplete) onSyncComplete();
      } else {
        setMessage({ type: 'error', text: res.stderr || 'Pull failed. Check credentials or conflicts.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error pulling commits' });
    } finally {
      setSyncing(null);
    }
  };

  const originRemote = remotes.find(r => r.name === 'origin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        style={{
          backgroundColor: 'var(--ide-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
          className="px-5 py-4 border-b flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              className="p-1.5 rounded-lg border"
            >
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--ide-text)' }}>GitHub Synchronization</h2>
              <p className="text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>Push, pull, and connect {projectName} with GitHub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--ide-text-muted)' }}
            className="p-1 rounded hover:opacity-80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {message && (
            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              message.type === 'success' 
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/40 border-red-500/30 text-red-300'
            }`}>
              {message.type === 'success' ? (
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
              )}
              <span className="flex-1 whitespace-pre-wrap">{message.text}</span>
            </div>
          )}

          {/* Connected Repo Status */}
          {originRemote ? (
            <div
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
              }}
              className="p-4 rounded-xl border space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-semibold" style={{ color: 'var(--ide-text)' }}>Connected Repository</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={loading || syncing !== null}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--ide-input-bg)',
                  borderColor: 'var(--ide-border)',
                }}
                className="flex items-center gap-2 text-xs font-mono p-2.5 rounded-lg border text-sky-400 break-all"
              >
                <Github className="w-4 h-4 flex-shrink-0 opacity-70" />
                <span className="flex-1 truncate">{originRemote.url}</span>
                <a
                  href={originRemote.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--ide-text-muted)' }}
                  className="hover:opacity-80"
                  title="Open on GitHub"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Personal Access Token Input */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--ide-text)' }}>
                    <Lock className="w-3 h-3 opacity-60" />
                    GitHub Token (Optional for public pull, Required for push)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-0.5"
                  >
                    Generate Token <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>
                  Tokens are only transmitted ephemerally to execute authenticated git operations and are never written to disk or client env.
                </p>
              </div>

              {/* Push & Pull Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handlePull}
                  disabled={syncing !== null}
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {syncing === 'pull' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  ) : (
                    <ArrowDown className="w-4 h-4 text-sky-400" />
                  )}
                  <span>Pull Changes ({currentBranch})</span>
                </button>

                <button
                  onClick={handlePush}
                  disabled={syncing !== null}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
                >
                  {syncing === 'push' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <ArrowUp className="w-4 h-4 text-white" />
                  )}
                  <span>Push Commits ({currentBranch})</span>
                </button>
              </div>
            </div>
          ) : (
            /* Link GitHub Repository Form */
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--ide-text)' }}>
                  GitHub Repository URL
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/username/repository.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
                  Enter HTTPS clone URL from your GitHub repository.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--ide-text)' }}>
                    <Lock className="w-3 h-3 opacity-60" />
                    Personal Access Token (Recommended)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-0.5"
                  >
                    Generate Token <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !repoUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Github className="w-4 h-4 text-white" />
                  )}
                  <span>Connect GitHub Repository</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text-muted)',
          }}
          className="px-5 py-3 border-t flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--ide-text-muted)' }}>Current branch:</span>
            <span
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              className="font-mono font-semibold px-2 py-0.5 rounded border"
            >
              {currentBranch || 'main'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
            className="px-3 py-1 rounded border text-xs hover:opacity-90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
