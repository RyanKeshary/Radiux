'use client';

import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit as GitCommitIcon, 
  Plus, 
  Minus, 
  RotateCcw, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  FolderGit2, 
  RefreshCw, 
  FileText, 
  Trash2, 
  GitMerge, 
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Github,
  X,
  Rocket,
  Globe,
  Server,
  PanelBottom,
  PanelLeft,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { DataService } from '@/lib/data-service';
import { GitStatus, GitCommit, GitFileChange } from '@/lib/types';
import { DiffViewerModal } from './DiffViewerModal';
import { GitHubModal } from './GitHubModal';
import { Sound } from '@/lib/audio';

interface GitPanelProps {
  projectId: string;
  projectName: string;
  userName: string;
  userEmail?: string;
  onActivityEvent?: (details: string) => void;
  onDockToBottom?: () => void;
  onDockToSidebar?: () => void;
  isDockedBottom?: boolean;
}

export function GitPanel({
  projectId,
  projectName,
  userName,
  userEmail = 'user@codecollab.dev',
  onActivityEvent,
  onDockToBottom,
  onDockToSidebar,
  isDockedBottom = false,
}: GitPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<{ name: string; isCurrent: boolean }[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'changes' | 'history' | 'branches' | 'deploy'>('changes');
  
  // Modals & deployment state
  const [selectedDiff, setSelectedDiff] = useState<{ file: string; diff: string; staged: boolean } | null>(null);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [selectedMergeBranch, setSelectedMergeBranch] = useState('');
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Cloud Deployments Live Status
  const [renderStatus, setRenderStatus] = useState<'unknown' | 'checking' | 'online' | 'waking'>('unknown');
  const [renderLatency, setRenderLatency] = useState<number | null>(null);
  const [vercelDeploying, setVercelDeploying] = useState(false);

  // Refresh Git Status
  const refreshGit = async () => {
    setLoading(true);
    try {
      const gitStatus = await DataService.getGitStatus(projectId);
      setStatus(gitStatus);

      if (gitStatus.isRepo) {
        setCurrentBranch(gitStatus.branch || 'main');
        const [log, branchData] = await Promise.all([
          DataService.getGitLog(projectId, 30),
          DataService.getGitBranches(projectId),
        ]);
        setCommits(log);
        setBranches(branchData.branches);
        if (branchData.current) {
          setCurrentBranch(branchData.current);
        }
      }
    } catch (err) {
      console.error('[GitPanel] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshGit();
  }, [projectId]);

  // Ping Render Backend
  const handlePingRender = async () => {
    setRenderStatus('checking');
    const start = performance.now();
    try {
      const res = await fetch('https://codecollab-backend-isjt.onrender.com/health', { method: 'GET' });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setRenderStatus('online');
        setRenderLatency(elapsed);
        Sound.playNotificationChime();
      } else {
        setRenderStatus('waking');
      }
    } catch (e) {
      setRenderStatus('waking');
    }
  };

  // Trigger Vercel Deploy (via push or webhook simulation)
  const handleDeployVercel = async () => {
    setVercelDeploying(true);
    Sound.playHapticPop();
    try {
      await handleDirectPush();
      setFeedback({
        type: 'success',
        text: 'Pushed to main! Vercel is now building and deploying latest commit.'
      });
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Deploy trigger failed' });
    } finally {
      setVercelDeploying(false);
    }
  };

  // Git Actions
  const handleInitRepo = async () => {
    setActionLoading(true);
    try {
      const res = await DataService.initGit(projectId, userName, userEmail);
      if (res.success) {
        if (onActivityEvent) onActivityEvent('initialized Git repository');
        await refreshGit();
        Sound.playNotificationChime();
      } else {
        alert(res.stderr || 'Failed to initialize Git repository');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStageFile = async (filePath: string) => {
    setActionLoading(true);
    try {
      await DataService.stageGitFiles(projectId, [filePath]);
      await refreshGit();
      Sound.playHapticPop();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStageAll = async () => {
    setActionLoading(true);
    try {
      await DataService.stageGitFiles(projectId, 'all');
      await refreshGit();
      Sound.playHapticPop();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    setActionLoading(true);
    try {
      await DataService.unstageGitFiles(projectId, [filePath]);
      await refreshGit();
      Sound.playHapticPop();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstageAll = async () => {
    setActionLoading(true);
    try {
      await DataService.unstageGitFiles(projectId, 'all');
      await refreshGit();
      Sound.playHapticPop();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiscardChanges = async (filePath: string) => {
    if (!confirm(`Discard changes to "${filePath}"? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await DataService.discardGitChanges(projectId, filePath);
      await refreshGit();
      Sound.playHapticPop();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim()) return;

    setActionLoading(true);
    try {
      const res = await DataService.commitGit(projectId, commitMessage.trim(), userName, userEmail);
      if (res.success) {
        setCommitMessage('');
        if (onActivityEvent) onActivityEvent(`committed: ${commitMessage.trim()}`);
        Sound.playNotificationChime();
        await refreshGit();
      } else {
        alert(res.stderr || 'Failed to commit changes. Make sure changes are staged.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleInspectDiff = async (file: string, staged: boolean) => {
    try {
      const res = await DataService.getGitDiff(projectId, { file, staged });
      if (res.success) {
        setSelectedDiff({ file, diff: res.diff, staged });
      } else {
        alert(res.error || 'No diff available');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleInspectCommitDiff = async (commit: GitCommit) => {
    try {
      const res = await DataService.getGitDiff(projectId, { commit: commit.hash });
      if (res.success) {
        setSelectedDiff({ file: `Commit ${commit.hash}: ${commit.message}`, diff: res.diff, staged: false });
      } else {
        alert(res.error || 'No diff available');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    setActionLoading(true);
    try {
      const res = await DataService.createGitBranch(projectId, newBranchName.trim());
      if (res.success) {
        setNewBranchName('');
        setShowNewBranchInput(false);
        if (onActivityEvent) onActivityEvent(`created branch ${newBranchName.trim()}`);
        await refreshGit();
        Sound.playHapticPop();
      } else {
        alert(res.stderr || 'Failed to create branch');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    if (branchName === currentBranch) return;
    setActionLoading(true);
    try {
      const res = await DataService.switchGitBranch(projectId, branchName);
      if (res.success) {
        if (onActivityEvent) onActivityEvent(`switched to branch ${branchName}`);
        await refreshGit();
        Sound.playHapticPop();
      } else {
        alert(res.stderr || 'Failed to switch branch. Check if you have uncommitted changes.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (!confirm(`Delete branch "${branchName}"?`)) return;
    setActionLoading(true);
    try {
      const res = await DataService.deleteGitBranch(projectId, branchName);
      if (res.success) {
        if (onActivityEvent) onActivityEvent(`deleted branch ${branchName}`);
        await refreshGit();
        Sound.playHapticPop();
      } else {
        alert(res.stderr || 'Failed to delete branch');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleMergeBranch = async () => {
    if (!selectedMergeBranch || selectedMergeBranch === currentBranch) return;
    setActionLoading(true);
    try {
      const res = await DataService.mergeGitBranch(projectId, selectedMergeBranch);
      if (res.success) {
        setShowMergeDropdown(false);
        if (onActivityEvent) onActivityEvent(`merged ${selectedMergeBranch} into ${currentBranch}`);
        await refreshGit();
        Sound.playNotificationChime();
      } else {
        alert(res.stderr || 'Merge failed. Check for git conflicts.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectPush = async () => {
    setSyncing('push');
    setFeedback(null);
    try {
      const remotes = await DataService.getGitHubRemotes(projectId);
      if (!remotes || remotes.length === 0) {
        setIsGitHubModalOpen(true);
        setFeedback({
          type: 'info',
          text: 'No GitHub remote connected. Connect your repository URL first.'
        });
        return;
      }

      const res = await DataService.pushToGitHub(projectId, currentBranch);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Pushed commits on branch '${currentBranch}' to remote!`
        });
        if (onActivityEvent) onActivityEvent(`pushed commits on branch ${currentBranch}`);
        Sound.playNotificationChime();
        await refreshGit();
      } else {
        setIsGitHubModalOpen(true);
        setFeedback({
          type: 'error',
          text: res.stderr || 'Push failed. Please check your GitHub credentials in the modal.'
        });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Push failed.' });
    } finally {
      setSyncing(null);
    }
  };

  const handleDirectPull = async () => {
    setSyncing('pull');
    setFeedback(null);
    try {
      const remotes = await DataService.getGitHubRemotes(projectId);
      if (!remotes || remotes.length === 0) {
        setIsGitHubModalOpen(true);
        return;
      }
      const res = await DataService.pullFromGitHub(projectId, currentBranch);
      if (res.success) {
        setFeedback({ type: 'success', text: `Pulled latest changes on '${currentBranch}'!` });
        await refreshGit();
        Sound.playNotificationChime();
      } else {
        setFeedback({ type: 'error', text: res.stderr || 'Pull failed.' });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Pull failed.' });
    } finally {
      setSyncing(null);
    }
  };

  if (status && !status.isRepo) {
    return (
      <div 
        className="h-full flex flex-col items-center justify-center p-6 text-center select-none"
        style={{ backgroundColor: 'var(--ide-dock)', color: 'var(--ide-text)' }}
      >
        <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
          <FolderGit2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold mb-1">No Git Repository</h3>
        <p className="text-xs max-w-xs mb-4 opacity-70" style={{ color: 'var(--ide-text-muted)' }}>
          Initialize Git for <strong>{projectName}</strong> to stage changes, track commits, and sync with GitHub, Vercel & Render.
        </p>
        <button
          onClick={handleInitRepo}
          disabled={actionLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>Initialize Git</span>
        </button>
      </div>
    );
  }

  const stagedCount = status?.staged.length || 0;
  const changesCount = (status?.unstaged.length || 0) + (status?.untracked.length || 0);

  return (
    <div 
      className="h-full flex flex-col overflow-hidden select-none text-xs"
      style={{ backgroundColor: 'var(--ide-dock)', color: 'var(--ide-text)' }}
    >
      {/* Sleek Compact Header */}
      <div 
        className="px-3 py-2 border-b flex items-center justify-between gap-2 flex-shrink-0"
        style={{ backgroundColor: 'var(--ide-dock-header)', borderColor: 'var(--ide-border)' }}
      >
        {/* Left: Branch Badge & Sync State */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => setActiveSubTab('branches')}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono hover:bg-white/10 transition-colors truncate"
            style={{ backgroundColor: 'var(--ide-input-bg)', color: 'var(--ide-text)' }}
            title="Switch branch"
          >
            <GitBranch className="w-3 h-3 text-sky-400 flex-shrink-0" />
            <span className="font-semibold truncate max-w-[90px]">{currentBranch}</span>
          </button>

          {status && (
            <div className="flex items-center gap-0.5 text-[10px]">
              <button
                onClick={handleDirectPush}
                disabled={syncing !== null || status.ahead === 0}
                className={`flex items-center px-1 py-0.5 rounded transition-colors ${
                  status.ahead > 0 ? 'text-emerald-400 font-bold bg-emerald-500/10' : 'opacity-40'
                }`}
                title={`${status.ahead} commit(s) ahead`}
              >
                <ArrowUp className="w-2.5 h-2.5" />
                <span>{status.ahead}</span>
              </button>
              <button
                onClick={handleDirectPull}
                disabled={syncing !== null || status.behind === 0}
                className={`flex items-center px-1 py-0.5 rounded transition-colors ${
                  status.behind > 0 ? 'text-sky-400 font-bold bg-sky-500/10' : 'opacity-40'
                }`}
                title={`${status.behind} commit(s) behind`}
              >
                <ArrowDown className="w-2.5 h-2.5" />
                <span>{status.behind}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Tools: Refresh, Deploy, Dock Toggle, GitHub */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={refreshGit}
            disabled={loading}
            className="p-1 rounded hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
            title="Refresh Git Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsGitHubModalOpen(true)}
            className="p-1 rounded hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
            title="GitHub Remote Configuration"
          >
            <Github className="w-3.5 h-3.5" />
          </button>

          {/* Docking Button (Toggle between Sidebar and Bottom Terminal) */}
          {isDockedBottom ? (
            <button
              onClick={onDockToSidebar}
              className="p-1 rounded text-sky-400 hover:bg-white/10 transition-colors"
              title="Move Git to Left Sidebar"
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onDockToBottom}
              className="p-1 rounded text-sky-400 hover:bg-white/10 transition-colors"
              title="Open Git in Bottom Terminal Dock"
            >
              <PanelBottom className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Modern Minimalist Subtabs */}
      <div 
        className="px-3 py-1.5 border-b flex items-center gap-1 text-[11px] overflow-x-auto flex-shrink-0"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        <button
          onClick={() => setActiveSubTab('changes')}
          className={`px-2.5 py-0.5 rounded-full font-medium transition-all ${
            activeSubTab === 'changes'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'opacity-60 hover:opacity-100 hover:bg-white/5'
          }`}
        >
          Changes {(stagedCount + changesCount) > 0 && `(${stagedCount + changesCount})`}
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-2.5 py-0.5 rounded-full font-medium transition-all ${
            activeSubTab === 'history'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'opacity-60 hover:opacity-100 hover:bg-white/5'
          }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveSubTab('branches')}
          className={`px-2.5 py-0.5 rounded-full font-medium transition-all ${
            activeSubTab === 'branches'
              ? 'bg-sky-500 text-white shadow-xs'
              : 'opacity-60 hover:opacity-100 hover:bg-white/5'
          }`}
        >
          Branches
        </button>
        <button
          onClick={() => setActiveSubTab('deploy')}
          className={`px-2.5 py-0.5 rounded-full font-medium transition-all flex items-center gap-1 ${
            activeSubTab === 'deploy'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-purple-400 hover:bg-purple-500/10'
          }`}
        >
          <Rocket className="w-3 h-3" />
          <span>Deploy</span>
        </button>
      </div>

      {/* Sync Feedback Banner */}
      {feedback && (
        <div className={`px-3 py-1.5 text-[11px] flex items-center justify-between border-b ${
          feedback.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
            : feedback.type === 'error'
            ? 'bg-rose-950/80 border-rose-800 text-rose-300'
            : 'bg-sky-950/80 border-sky-800 text-sky-300'
        }`}>
          <div className="flex items-center gap-1.5 min-w-0">
            {feedback.type === 'success' ? (
              <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
            )}
            <span className="truncate">{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-0.5 opacity-60 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Tab 1: Changes (VS Code / Linear Minimalist View) */}
      {activeSubTab === 'changes' && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Commit Input Box */}
          <div className="p-3 border-b space-y-2 flex-shrink-0" style={{ borderColor: 'var(--ide-border)' }}>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message (Ctrl+Enter to commit)..."
              rows={2}
              className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-sans resize-none transition-all"
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  handleCommit();
                }
              }}
            />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCommit()}
                disabled={actionLoading || !commitMessage.trim() || stagedCount === 0}
                className="flex-1 py-1.5 px-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
              >
                {actionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <GitCommitIcon className="w-3.5 h-3.5" />
                )}
                <span>Commit ({stagedCount})</span>
              </button>

              <button
                type="button"
                onClick={handleDirectPush}
                disabled={syncing !== null}
                className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                title="Push to Remote"
              >
                {syncing === 'push' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5" />
                )}
                <span>Push</span>
              </button>
            </div>
          </div>

          {/* Minimalist File Tree / List */}
          <div className="flex-1 p-2 space-y-3 overflow-y-auto">
            {/* Staged Section */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1 text-[10.5px] font-bold uppercase tracking-wider opacity-60">
                <span>Staged Changes ({stagedCount})</span>
                {stagedCount > 0 && (
                  <button
                    onClick={handleUnstageAll}
                    className="lowercase hover:underline text-sky-400 font-normal"
                  >
                    unstage all
                  </button>
                )}
              </div>

              {stagedCount === 0 ? (
                <div className="px-2 py-1 text-[11px] opacity-40 italic">
                  No staged changes
                </div>
              ) : (
                <div className="space-y-0.5">
                  {status?.staged.map((f) => (
                    <div
                      key={f.path}
                      className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-white/5 transition-colors text-xs font-mono"
                    >
                      <div 
                        onClick={() => handleInspectDiff(f.path, true)}
                        className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                      >
                        <span className={`w-3.5 text-center font-bold text-[10px] ${
                          f.status === 'A' ? 'text-emerald-400' : f.status === 'D' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {f.status}
                        </span>
                        <span className="truncate text-slate-200">{f.path}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleInspectDiff(f.path, true)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                          title="Inspect Diff"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleUnstageFile(f.path)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400"
                          title="Unstage"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Changes Section */}
            <div>
              <div className="flex items-center justify-between px-1 mb-1 text-[10.5px] font-bold uppercase tracking-wider opacity-60">
                <span>Changes ({changesCount})</span>
                {changesCount > 0 && (
                  <button
                    onClick={handleStageAll}
                    className="lowercase hover:underline text-sky-400 font-normal"
                  >
                    stage all
                  </button>
                )}
              </div>

              {changesCount === 0 ? (
                <div className="px-2 py-1 text-[11px] opacity-40 italic">
                  Working tree clean
                </div>
              ) : (
                <div className="space-y-0.5">
                  {/* Unstaged files */}
                  {status?.unstaged.map((f) => (
                    <div
                      key={f.path}
                      className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-white/5 transition-colors text-xs font-mono"
                    >
                      <div 
                        onClick={() => handleInspectDiff(f.path, false)}
                        className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                      >
                        <span className={`w-3.5 text-center font-bold text-[10px] ${
                          f.status === 'D' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {f.status}
                        </span>
                        <span className="truncate text-slate-200">{f.path}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleInspectDiff(f.path, false)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                          title="Inspect Diff"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleStageFile(f.path)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-emerald-400"
                          title="Stage"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDiscardChanges(f.path)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-rose-400"
                          title="Discard changes"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Untracked files */}
                  {status?.untracked.map((f) => (
                    <div
                      key={f.path}
                      className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-white/5 transition-colors text-xs font-mono"
                    >
                      <div 
                        onClick={() => handleStageFile(f.path)}
                        className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                      >
                        <span className="w-3.5 text-center font-bold text-[10px] text-emerald-400">
                          U
                        </span>
                        <span className="truncate text-slate-200">{f.path}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStageFile(f.path)}
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-emerald-400"
                          title="Stage file"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Commit History */}
      {activeSubTab === 'history' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {commits.length === 0 ? (
            <div className="p-8 text-center opacity-40">No commits found.</div>
          ) : (
            commits.map((c) => (
              <div
                key={c.hash}
                onClick={() => handleInspectCommitDiff(c)}
                className="p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[11px] text-sky-400 font-semibold">{c.hash}</span>
                  <span className="text-[10px] opacity-50">{c.date}</span>
                </div>
                <p className="text-xs text-slate-200 font-medium truncate mt-0.5">{c.message}</p>
                <span className="text-[10px] opacity-60 truncate block">{c.author}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Branches */}
      {activeSubTab === 'branches' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Create Branch */}
          <form onSubmit={handleCreateBranch} className="flex items-center gap-1.5">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="New branch name..."
              className="flex-1 px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-sky-500 font-mono"
              style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
            />
            <button
              type="submit"
              disabled={!newBranchName.trim() || actionLoading}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs"
            >
              Create
            </button>
          </form>

          {/* Branch List */}
          <div className="space-y-1">
            {branches.map((b) => (
              <div
                key={b.name}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${
                  b.isCurrent ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 font-semibold' : 'border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-mono truncate">{b.name}</span>
                  {b.isCurrent && <span className="text-[9px] px-1.5 py-0.2 bg-sky-500/20 rounded-full">Current</span>}
                </div>

                {!b.isCurrent && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSwitchBranch(b.name)}
                      className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px]"
                    >
                      Switch
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(b.name)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Cloud Deployments (Vercel & Render) */}
      {activeSubTab === 'deploy' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Vercel Card */}
          <div 
            className="p-3.5 rounded-xl border space-y-2.5 backdrop-blur-md"
            style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-black text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/20">
                  ▲
                </div>
                <div>
                  <h4 className="font-bold text-xs" style={{ color: 'var(--ide-text)' }}>Vercel Frontend</h4>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live Production
                  </p>
                </div>
              </div>

              <a
                href="https://code-collab-ide.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded text-sky-400 hover:bg-white/10"
                title="Open Live App"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-2 rounded-lg bg-black/20 text-[11px] font-mono text-slate-300 truncate">
              https://code-collab-ide.vercel.app
            </div>

            <button
              onClick={handleDeployVercel}
              disabled={vercelDeploying}
              className="w-full py-1.5 px-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              {vercelDeploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              <span>Deploy to Vercel (Push Main)</span>
            </button>
          </div>

          {/* Render Backend Card */}
          <div 
            className="p-3.5 rounded-xl border space-y-2.5 backdrop-blur-md"
            style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs">
                  <Server className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs" style={{ color: 'var(--ide-text)' }}>Render Backend</h4>
                  <p className="text-[10px] text-slate-400">
                    WebSocket + Node.js Service
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {renderStatus === 'online' && (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {renderLatency ? `${renderLatency}ms` : 'Active'}
                  </span>
                )}
                {renderStatus === 'waking' && (
                  <span className="text-[10px] text-amber-400">Waking up...</span>
                )}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-black/20 text-[11px] font-mono text-slate-300 truncate">
              https://codecollab-backend-isjt.onrender.com
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePingRender}
                disabled={renderStatus === 'checking'}
                className="flex-1 py-1.5 px-3 bg-white/10 hover:bg-white/15 text-slate-200 font-medium rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
              >
                {renderStatus === 'checking' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>Ping /health</span>
              </button>

              <a
                href="https://dashboard.render.com"
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <span>Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {selectedDiff && (
        <DiffViewerModal
          isOpen={true}
          onClose={() => setSelectedDiff(null)}
          filePath={selectedDiff.file}
          diff={selectedDiff.diff}
          isStaged={selectedDiff.staged}
        />
      )}

      {/* GitHub Sync Modal */}
      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
        currentBranch={currentBranch}
        onSyncComplete={refreshGit}
      />
    </div>
  );
}
