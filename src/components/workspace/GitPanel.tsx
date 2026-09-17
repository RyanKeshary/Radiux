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
  Terminal,
  PanelBottom,
  X,
  Cloud
} from 'lucide-react';
import { DataService } from '@/lib/data-service';
import { GitStatus, GitCommit, GitFileChange } from '@/lib/types';
import { DiffViewerModal } from './DiffViewerModal';
import { GitHubModal } from './GitHubModal';

interface GitPanelProps {
  projectId: string;
  projectName: string;
  userName: string;
  userEmail?: string;
  onActivityEvent?: (details: string) => void;
  onLogOutput?: (channel: 'git' | 'system' | 'sync' | 'runtime', text: string) => void;
  onSwitchToTerminal?: (tab?: 'terminal' | 'output') => void;
  onOpenInBottomPanel?: () => void;
  isBottomPanel?: boolean;
}

export function GitPanel({
  projectId,
  projectName,
  userName,
  userEmail = 'user@radiux.dev',
  onActivityEvent,
  onLogOutput,
  onSwitchToTerminal,
  onOpenInBottomPanel,
  isBottomPanel = false,
}: GitPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<{ name: string; isCurrent: boolean }[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('main');
  
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'changes' | 'history' | 'branches'>('changes');
  
  // Modals state
  const [selectedDiff, setSelectedDiff] = useState<{ file: string; diff: string; staged: boolean } | null>(null);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [selectedMergeBranch, setSelectedMergeBranch] = useState('');
  const [showMergeDropdown, setShowMergeDropdown] = useState(false);
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load Git status, commits and branches
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

  // Git Initialization
  const handleInitRepo = async () => {
    setActionLoading(true);
    try {
      const res = await DataService.initGit(projectId, userName, userEmail);
      if (res.success) {
        if (onActivityEvent) onActivityEvent('initialized Git repository');
        await refreshGit();
      } else {
        alert(res.stderr || 'Failed to initialize Git repository');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Stage / Unstage / Discard
  const handleStageFile = async (filePath: string) => {
    setActionLoading(true);
    try {
      await DataService.stageGitFiles(projectId, [filePath]);
      await refreshGit();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStageAll = async () => {
    setActionLoading(true);
    try {
      await DataService.stageGitFiles(projectId, 'all');
      await refreshGit();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    setActionLoading(true);
    try {
      await DataService.unstageGitFiles(projectId, [filePath]);
      await refreshGit();
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstageAll = async () => {
    setActionLoading(true);
    try {
      await DataService.unstageGitFiles(projectId, 'all');
      await refreshGit();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiscardFile = async (filePath: string) => {
    if (!confirm(`Discard all changes in "${filePath}"? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await DataService.discardGitFiles(projectId, [filePath]);
      await refreshGit();
    } finally {
      setActionLoading(false);
    }
  };

  // Commit
  const handleCommit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim()) return;

    setActionLoading(true);
    try {
      const res = await DataService.commitGit(projectId, commitMessage.trim(), userName, userEmail);
      if (res.success) {
        if (onLogOutput) onLogOutput('git', `[git commit -m "${commitMessage.trim()}"] Changes committed successfully.`);
        setCommitMessage('');
        if (onActivityEvent) onActivityEvent(`committed "${commitMessage.trim().substring(0, 40)}"`);
        await refreshGit();
      } else {
        if (onLogOutput) onLogOutput('git', `[git commit error] ${res.stderr || 'Commit failed.'}`);
        alert(res.stderr || 'Failed to commit. Ensure changes are staged first.');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Inspect Diff
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

  // Inspect Commit Diff
  const handleInspectCommitDiff = async (commit: GitCommit) => {
    try {
      const res = await DataService.getGitDiff(projectId, { commit: commit.hash });
      if (res.success) {
        setSelectedDiff({ file: `Commit ${commit.hash}: ${commit.message}`, diff: res.diff, staged: false });
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Branch operations
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
      } else {
        alert(res.stderr || 'Failed to switch branch. Check if you have uncommitted changes.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (branchName === currentBranch) {
      alert('Cannot delete currently checked out branch');
      return;
    }
    if (!confirm(`Delete branch "${branchName}"?`)) return;

    setActionLoading(true);
    try {
      const res = await DataService.deleteGitBranch(projectId, branchName);
      if (res.success) {
        await refreshGit();
      } else {
        alert(res.stderr || 'Failed to delete branch. Ensure it is merged first.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleMergeBranch = async () => {
    if (!selectedMergeBranch) return;
    if (!confirm(`Merge branch "${selectedMergeBranch}" into "${currentBranch}"?`)) return;

    setActionLoading(true);
    try {
      const res = await DataService.mergeGitBranch(projectId, selectedMergeBranch);
      if (res.success) {
        setShowMergeDropdown(false);
        setSelectedMergeBranch('');
        if (onActivityEvent) onActivityEvent(`merged branch ${selectedMergeBranch} into ${currentBranch}`);
        await refreshGit();
      } else {
        alert(res.stderr || 'Merge failed. Resolve any conflicts in the editor.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Direct Push & Pull operations
  const handleDirectPush = async () => {
    setSyncing('push');
    setFeedback(null);
    try {
      const remotes = await DataService.getGitHubRemotes(projectId);
      if (!remotes || remotes.length === 0) {
        setIsGitHubModalOpen(true);
        setFeedback({
          type: 'info',
          text: 'No GitHub remote repository connected. Please connect your GitHub repository URL first.'
        });
        return;
      }

      const res = await DataService.pushToGitHub(projectId, currentBranch);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Successfully pushed commits on branch '${currentBranch}' to remote!`
        });
        if (onActivityEvent) onActivityEvent(`pushed commits on branch ${currentBranch} to remote`);
        await refreshGit();
      } else {
        // If push requires authentication or token
        if (res.stderr?.toLowerCase().includes('authentication') ||
            res.stderr?.toLowerCase().includes('permission') ||
            res.stderr?.toLowerCase().includes('password') ||
            res.stderr?.toLowerCase().includes('support for password') ||
            res.stderr?.toLowerCase().includes('token')) {
          setIsGitHubModalOpen(true);
          setFeedback({
            type: 'error',
            text: 'GitHub authentication required. Please enter your Personal Access Token in the GitHub modal.'
          });
        } else {
          setFeedback({
            type: 'error',
            text: res.stderr || 'Push failed. Ensure remote exists and branch is up to date.'
          });
        }
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Push failed due to network error.' });
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
        setFeedback({
          type: 'info',
          text: 'No GitHub remote repository connected. Please connect your GitHub repository URL first.'
        });
        return;
      }

      const res = await DataService.pullFromGitHub(projectId, currentBranch);
      if (res.success) {
        setFeedback({
          type: 'success',
          text: `Successfully pulled latest changes on branch '${currentBranch}'!`
        });
        if (onActivityEvent) onActivityEvent(`pulled changes on branch ${currentBranch} from remote`);
        await refreshGit();
      } else {
        if (res.stderr?.toLowerCase().includes('authentication') ||
            res.stderr?.toLowerCase().includes('permission') ||
            res.stderr?.toLowerCase().includes('token')) {
          setIsGitHubModalOpen(true);
          setFeedback({
            type: 'error',
            text: 'GitHub authentication required. Please enter your Personal Access Token in the GitHub modal.'
          });
        } else {
          setFeedback({
            type: 'error',
            text: res.stderr || 'Pull failed. Check credentials or git conflicts.'
          });
        }
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Pull failed due to network error.' });
    } finally {
      setSyncing(null);
    }
  };

  if (status && !status.isRepo) {
    return (
      <div 
        className="h-full flex flex-col items-center justify-center p-6 text-center"
        style={{
          backgroundColor: 'var(--ide-dock)',
          color: 'var(--ide-text)',
        }}
      >
        <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
          <FolderGit2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ide-text)' }}>No Git Repository Found</h3>
        <p className="text-xs max-w-sm mb-4" style={{ color: 'var(--ide-text-muted)' }}>
          Initialize a Git repository for <strong>{projectName}</strong> to enable staging, commits, branch management, and GitHub synchronization.
        </p>
        <button
          onClick={handleInitRepo}
          disabled={actionLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>Initialize Git Repository</span>
        </button>
      </div>
    );
  }

  const stagedCount = status?.staged.length || 0;
  const changesCount = (status?.unstaged.length || 0) + (status?.untracked.length || 0);

  return (
    <div 
      className="h-full flex flex-col overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Top Action Bar: Fully responsive 2-row proportional layout */}
      <div 
        className="px-3 py-2 border-b flex flex-col gap-2"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
        }}
      >
        {/* Row 1: Branch info on left, Quick Actions on right */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-shrink">
            <div 
              className="flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono truncate"
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
            >
              <GitBranch className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span className="font-semibold truncate max-w-[110px]">{currentBranch}</span>
            </div>

            {status && (
              <div className="flex items-center gap-1 text-[11px] flex-shrink-0">
                <button
                  onClick={handleDirectPush}
                  disabled={syncing !== null || status.ahead === 0}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                    status.ahead > 0
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold cursor-pointer border border-emerald-500/30'
                      : 'text-neutral-500 cursor-default opacity-60'
                  }`}
                  title={status.ahead > 0 ? `Click to push ${status.ahead} commit(s) to remote` : 'No outgoing commits'}
                >
                  <ArrowUp className={`w-3 h-3 ${syncing === 'push' ? 'animate-bounce' : ''}`} />
                  <span>{status.ahead}</span>
                </button>

                <button
                  onClick={handleDirectPull}
                  disabled={syncing !== null || status.behind === 0}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                    status.behind > 0
                      ? 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 font-semibold cursor-pointer border border-sky-500/30'
                      : 'text-neutral-500 cursor-default opacity-60'
                  }`}
                  title={status.behind > 0 ? `Click to pull ${status.behind} commit(s) from remote` : 'No incoming commits'}
                >
                  <ArrowDown className={`w-3 h-3 ${syncing === 'pull' ? 'animate-bounce' : ''}`} />
                  <span>{status.behind}</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Tools: Push, Pull, GitHub, Terminal, Dock, Refresh */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleDirectPush}
              disabled={syncing !== null}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors border ${
                status && status.ahead > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm font-semibold'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: status && status.ahead > 0 ? undefined : 'var(--ide-input-bg)',
                borderColor: status && status.ahead > 0 ? undefined : 'var(--ide-border)',
                color: status && status.ahead > 0 ? undefined : 'var(--ide-text)',
              }}
              title="Push commits to GitHub remote"
            >
              {syncing === 'push' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden sm:inline">Push</span>
              {status && status.ahead > 0 && <span className="text-[10px]">({status.ahead})</span>}
            </button>

            <button
              onClick={handleDirectPull}
              disabled={syncing !== null}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border transition-colors hover:opacity-80"
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              title="Pull changes from GitHub remote"
            >
              {syncing === 'pull' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span className="hidden sm:inline">Pull</span>
            </button>

            <button
              onClick={() => setIsGitHubModalOpen(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border transition-colors hover:opacity-80"
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              title="GitHub Remote & Sync"
            >
              <Github className="w-3.5 h-3.5" style={{ color: 'var(--ide-text-muted)' }} />
              <span className="hidden md:inline">GitHub</span>
            </button>

            {onSwitchToTerminal && (
              <button
                onClick={() => onSwitchToTerminal('output')}
                className="p-1 rounded hover:opacity-80 transition-colors text-neutral-400 hover:text-sky-400"
                title="Inspect Git logs in output dock"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenInBottomPanel && !isBottomPanel && (
              <button
                onClick={onOpenInBottomPanel}
                className="p-1 rounded hover:opacity-80 transition-colors text-neutral-400 hover:text-sky-400"
                title="Open Git in Bottom Dock"
              >
                <PanelBottom className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={refreshGit}
              disabled={loading}
              className="p-1 rounded hover:opacity-80 transition-colors"
              style={{ color: 'var(--ide-text-muted)' }}
              title="Refresh Git Status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Subtabs: Changes, History, Branches */}
        <div 
          className="grid grid-cols-3 gap-1 p-0.5 rounded-lg border text-xs w-full"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <button
            onClick={() => setActiveSubTab('changes')}
            className={`px-1 py-1 rounded-md transition-colors font-medium text-center truncate flex items-center justify-center gap-1 min-w-0 ${
              activeSubTab === 'changes'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={{
              color: activeSubTab === 'changes' ? '#ffffff' : 'var(--ide-text-muted)',
            }}
            title={`Changes (${stagedCount + changesCount})`}
          >
            <span className="truncate">Changes</span>
            {(stagedCount + changesCount) > 0 && (
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                activeSubTab === 'changes' ? 'bg-white/20 text-white' : 'bg-sky-500/20 text-sky-400'
              }`}>
                {stagedCount + changesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-1 py-1 rounded-md transition-colors font-medium text-center truncate flex items-center justify-center gap-1 min-w-0 ${
              activeSubTab === 'history'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={{
              color: activeSubTab === 'history' ? '#ffffff' : 'var(--ide-text-muted)',
            }}
            title={`History (${commits.length})`}
          >
            <span className="truncate">History</span>
            {commits.length > 0 && (
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                activeSubTab === 'history' ? 'bg-white/20 text-white' : 'bg-neutral-500/20 text-neutral-400'
              }`}>
                {commits.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('branches')}
            className={`px-1 py-1 rounded-md transition-colors font-medium text-center truncate min-w-0 ${
              activeSubTab === 'branches'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'hover:opacity-80'
            }`}
            style={{
              color: activeSubTab === 'branches' ? '#ffffff' : 'var(--ide-text-muted)',
            }}
            title="Branches"
          >
            <span className="truncate">Branches</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Alert Banner */}
      {feedback && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
          feedback.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
            : feedback.type === 'error'
            ? 'bg-rose-950/80 border-rose-800 text-rose-300'
            : 'bg-sky-950/80 border-sky-800 text-sky-300'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {feedback.type === 'success' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="truncate">{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-0.5 hover:opacity-75 text-neutral-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Body Subtab Views */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Subtab 1: Changes & Commit */}
        {activeSubTab === 'changes' && (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Top: Commit Box */}
            <div 
              className="p-3 border-b flex-shrink-0"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
              }}
            >
              <form onSubmit={handleCommit} className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold" style={{ color: 'var(--ide-text)' }}>
                      Commit Message
                    </label>
                    <span className="text-[10px] font-mono text-sky-400">
                      {currentBranch}
                    </span>
                  </div>
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Enter commit message (e.g. Add collaborative editor sync)..."
                    rows={2}
                    className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-sans resize-none"
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
                  <div className="flex items-center justify-between text-[10px] mt-0.5" style={{ color: 'var(--ide-text-muted)' }}>
                    <span>Press Ctrl+Enter to commit</span>
                    {status && status.ahead > 0 && (
                      <span className="text-emerald-400 font-medium">({status.ahead} ahead)</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <button
                    type="submit"
                    disabled={actionLoading || !commitMessage.trim() || stagedCount === 0}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <GitCommitIcon className="w-3.5 h-3.5" />
                    )}
                    <span>Commit ({stagedCount} staged)</span>
                  </button>

                  {stagedCount === 0 && changesCount > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleStageAll();
                        if (commitMessage.trim()) {
                          await handleCommit();
                        }
                      }}
                      className="w-full text-center text-[11px] text-neutral-400 hover:text-white hover:underline py-0.5"
                    >
                      Stage all changes & commit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDirectPush}
                    disabled={syncing !== null}
                    style={{
                      backgroundColor: status && status.ahead > 0 ? undefined : 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: status && status.ahead > 0 ? '#ffffff' : 'var(--ide-text)',
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                      status && status.ahead > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                        : 'hover:opacity-90 border'
                    }`}
                  >
                    {syncing === 'push' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>
                      {status && status.ahead > 0
                        ? `Push ${status.ahead} commit${status.ahead > 1 ? 's' : ''} to Remote`
                        : 'Push to Remote'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Middle: Changed Files Lists */}
            <div className="flex-1 p-3 space-y-4">
              {/* Staged Changes Section */}
              <div className="space-y-1.5">
                <div 
                  className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase"
                  style={{ color: 'var(--ide-text-muted)' }}
                >
                  <span className="flex items-center gap-1.5">
                    Staged Changes ({stagedCount})
                  </span>
                  {stagedCount > 0 && (
                    <button
                      onClick={handleUnstageAll}
                      disabled={actionLoading}
                      className="text-[11px] hover:underline flex items-center gap-1 lowercase"
                      style={{ color: 'var(--ide-text-muted)' }}
                    >
                      <Minus className="w-3 h-3" /> unstage all
                    </button>
                  )}
                </div>

                {stagedCount === 0 ? (
                  <div className="text-[11px] text-neutral-500 italic py-1">
                    No changes staged for commit
                  </div>
                ) : (
                  <div className="space-y-1">
                    {status?.staged.map((f) => (
                      <div
                        key={f.path}
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded border transition-colors text-xs"
                        style={{
                          backgroundColor: 'var(--ide-card-bg)',
                          borderColor: 'var(--ide-border)',
                        }}
                      >
                        <div 
                          onClick={() => handleInspectDiff(f.path, true)}
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                        >
                          <span className={`w-4 text-center font-mono font-bold text-[10px] ${
                            f.status === 'A' ? 'text-emerald-400' : f.status === 'D' ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {f.status}
                          </span>
                          <span className="font-mono truncate" style={{ color: 'var(--ide-text)' }}>{f.path}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleInspectDiff(f.path, true)}
                            className="p-1 rounded hover:opacity-80"
                            style={{ color: 'var(--ide-text-muted)' }}
                            title="View Diff"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleUnstageFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded hover:text-amber-400"
                            style={{ color: 'var(--ide-text-muted)' }}
                            title="Unstage File"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Working Tree Changes Section */}
              <div className="space-y-1.5 pt-2">
                <div 
                  className="flex items-center justify-between text-xs font-semibold tracking-wider uppercase"
                  style={{ color: 'var(--ide-text-muted)' }}
                >
                  <span className="flex items-center gap-1.5">
                    Changes ({changesCount})
                  </span>
                  {changesCount > 0 && (
                    <button
                      onClick={handleStageAll}
                      disabled={actionLoading}
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 lowercase"
                    >
                      <Plus className="w-3 h-3" /> stage all
                    </button>
                  )}
                </div>

                {changesCount === 0 ? (
                  <div className="text-[11px] italic py-1" style={{ color: 'var(--ide-text-muted)' }}>
                    Working tree clean (no uncommitted changes)
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Unstaged tracked files */}
                    {status?.unstaged.map((f) => (
                      <div
                        key={f.path}
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded border transition-colors text-xs"
                        style={{
                          backgroundColor: 'var(--ide-card-bg)',
                          borderColor: 'var(--ide-border)',
                        }}
                      >
                        <div 
                          onClick={() => handleInspectDiff(f.path, false)}
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                        >
                          <span className={`w-4 text-center font-mono font-bold text-[10px] ${
                            f.status === 'D' ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {f.status}
                          </span>
                          <span className="font-mono truncate" style={{ color: 'var(--ide-text)' }}>{f.path}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleInspectDiff(f.path, false)}
                            className="p-1 rounded hover:opacity-80"
                            style={{ color: 'var(--ide-text-muted)' }}
                            title="View Diff"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDiscardFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded hover:text-red-400"
                            style={{ color: 'var(--ide-text-muted)' }}
                            title="Discard Changes"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleStageFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded hover:text-emerald-400"
                            style={{ color: 'var(--ide-text-muted)' }}
                            title="Stage File"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Untracked files */}
                    {status?.untracked.map((f) => (
                      <div
                        key={f.path}
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded border transition-colors text-xs"
                        style={{
                          backgroundColor: 'var(--ide-card-bg)',
                          borderColor: 'var(--ide-border)',
                        }}
                      >
                        <div 
                          onClick={() => handleInspectDiff(f.path, false)}
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="w-4 text-center font-mono font-bold text-[10px] text-emerald-400">
                            U
                          </span>
                          <span className="font-mono truncate" style={{ color: 'var(--ide-text)' }}>{f.path}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStageFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded hover:text-emerald-400"
                            style={{ color: 'var(--ide-text-muted)' }}
                            title="Stage Untracked File"
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

            {/* Bottom: Working Tree Summary */}
            <div
              className="p-3 border-t text-[11px] space-y-1 flex-shrink-0"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text-muted)',
              }}
            >
              <div className="flex justify-between">
                <span>Author:</span>
                <span className="font-medium" style={{ color: 'var(--ide-text)' }}>{userName}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Branch:</span>
                <span className="text-sky-400 font-mono font-medium">{currentBranch}</span>
              </div>
              {status?.lastCommit && (
                <div className="border-t pt-1 mt-1" style={{ borderColor: 'var(--ide-border)' }}>
                  <span className="block" style={{ color: 'var(--ide-text-muted)' }}>Last Commit:</span>
                  <span className="truncate block font-medium" style={{ color: 'var(--ide-text)' }}>
                    {status.lastCommit.message}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>
                    {status.lastCommit.author} • {status.lastCommit.relativeDate}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subtab 2: Commit History */}
        {activeSubTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4">
            {commits.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--ide-text-muted)' }}>
                No commits found in this repository yet. Stage changes and make your first commit!
              </div>
            ) : (
              <div className="space-y-2">
                {commits.map((c) => (
                  <div
                    key={c.fullHash}
                    onClick={() => handleInspectCommitDiff(c)}
                    style={{
                      backgroundColor: 'var(--ide-card-bg)',
                      borderColor: 'var(--ide-border)',
                    }}
                    className="p-3 rounded-xl border hover:border-sky-500/50 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-1 min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <GitCommitIcon className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        <span className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>{c.message}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" style={{ color: 'var(--ide-text-muted)' }} />
                          {c.author}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" style={{ color: 'var(--ide-text-muted)' }} />
                          {c.relativeDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-xs px-2 py-1 rounded border"
                        style={{
                          backgroundColor: 'var(--ide-input-bg)',
                          borderColor: 'var(--ide-border)',
                          color: 'var(--ide-text-muted)',
                        }}
                      >
                        {c.hash}
                      </span>
                      <ChevronRight className="w-4 h-4 transition-colors" style={{ color: 'var(--ide-text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subtab 3: Branches Management */}
        {activeSubTab === 'branches' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto w-full">
            {/* Branch Header & Create */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ide-text)' }}>Repository Branches</h3>
                <p className="text-xs" style={{ color: 'var(--ide-text-muted)' }}>Create, switch, merge and manage your workspace branches</p>
              </div>

              <button
                onClick={() => setShowNewBranchInput(!showNewBranchInput)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Branch</span>
              </button>
            </div>

            {/* Create Branch Form */}
            {showNewBranchInput && (
              <form
                onSubmit={handleCreateBranch}
                style={{
                  backgroundColor: 'var(--ide-card-bg)',
                  borderColor: 'var(--ide-border)',
                }}
                className="p-3.5 rounded-xl border flex items-center gap-2"
              >
                <GitBranch className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. feature/authentication or bugfix/header"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="flex-1 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={actionLoading || !newBranchName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Create & Switch
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewBranchInput(false)}
                  style={{ color: 'var(--ide-text-muted)' }}
                  className="px-2 py-1.5 text-xs hover:opacity-80"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Merge Branch Bar */}
            <div
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
              }}
              className="p-4 rounded-xl border space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--ide-text)' }}>
                  <GitMerge className="w-4 h-4 text-emerald-400" />
                  <span>Merge into {currentBranch}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMergeBranch}
                  onChange={(e) => setSelectedMergeBranch(e.target.value)}
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                  className="flex-1 px-3 py-1.5 text-xs border rounded-lg focus:outline-none font-mono"
                >
                  <option value="">Select branch to merge into {currentBranch}...</option>
                  {branches.filter(b => b.name !== currentBranch).map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleMergeBranch}
                  disabled={actionLoading || !selectedMergeBranch}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                >
                  Merge
                </button>
              </div>
            </div>

            {/* Branch List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ide-text-muted)' }}>All Branches</h4>
              <div className="space-y-1.5">
                {branches.map((b) => (
                  <div
                    key={b.name}
                    style={{
                      backgroundColor: b.isCurrent ? undefined : 'var(--ide-card-bg)',
                      borderColor: b.isCurrent ? undefined : 'var(--ide-border)',
                      color: b.isCurrent ? undefined : 'var(--ide-text)',
                    }}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${
                      b.isCurrent
                        ? 'bg-sky-950/30 border-sky-500/40 text-sky-400 font-semibold'
                        : 'hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <GitBranch className={`w-4 h-4 ${b.isCurrent ? 'text-sky-400' : 'opacity-60'}`} />
                      <span className="font-mono">{b.name}</span>
                      {b.isCurrent && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!b.isCurrent && (
                        <>
                          <button
                            onClick={() => handleSwitchBranch(b.name)}
                            disabled={actionLoading}
                            style={{
                              backgroundColor: 'var(--ide-input-bg)',
                              borderColor: 'var(--ide-border)',
                              color: 'var(--ide-text)',
                            }}
                            className="px-2.5 py-1 rounded border text-[11px] transition-colors hover:opacity-80"
                          >
                            Switch
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b.name)}
                            disabled={actionLoading}
                            style={{ color: 'var(--ide-text-muted)' }}
                            className="p-1 rounded hover:text-red-400 transition-colors"
                            title="Delete Branch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

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
