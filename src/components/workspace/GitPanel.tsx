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
  X
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
}

export function GitPanel({
  projectId,
  projectName,
  userName,
  userEmail = 'user@codecollab.dev',
  onActivityEvent,
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
        setCommitMessage('');
        if (onActivityEvent) onActivityEvent(`committed "${commitMessage.trim().substring(0, 40)}"`);
        await refreshGit();
      } else {
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
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-[#181818] text-neutral-300">
        <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
          <FolderGit2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-white mb-1">No Git Repository Found</h3>
        <p className="text-xs text-neutral-400 max-w-sm mb-4">
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
    <div className="h-full flex flex-col bg-[#181818] text-neutral-200 overflow-hidden select-none">
      {/* Top Action Bar */}
      <div className="px-4 py-2.5 bg-[#202020] border-b border-[#303030] flex items-center justify-between">
        {/* Left: Branch & Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#2a2a2a] border border-[#3c3c3c] text-xs font-mono text-white">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold">{currentBranch}</span>
          </div>

          {status && (
            <div className="flex items-center gap-1 text-[11px]">
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

        {/* Center Subtabs */}
        <div className="flex items-center gap-1 bg-[#181818] p-0.5 rounded-lg border border-[#333333] text-xs">
          <button
            onClick={() => setActiveSubTab('changes')}
            className={`px-3 py-1 rounded-md transition-colors font-medium ${
              activeSubTab === 'changes'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Changes {(stagedCount + changesCount) > 0 && `(${stagedCount + changesCount})`}
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1 rounded-md transition-colors font-medium ${
              activeSubTab === 'history'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            History {commits.length > 0 && `(${commits.length})`}
          </button>
          <button
            onClick={() => setActiveSubTab('branches')}
            className={`px-3 py-1 rounded-md transition-colors font-medium ${
              activeSubTab === 'branches'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Branches
          </button>
        </div>

        {/* Right Tools: Push, Pull, Refresh & GitHub */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDirectPush}
            disabled={syncing !== null}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors border ${
              status && status.ahead > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm font-semibold'
                : 'bg-[#2a2a2a] hover:bg-[#333333] text-neutral-300 border-[#404040]'
            }`}
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
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#2a2a2a] hover:bg-[#333333] text-xs text-neutral-300 hover:text-white border border-[#404040] transition-colors"
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2a2a2a] hover:bg-[#333333] text-xs text-white border border-[#404040] transition-colors"
            title="GitHub Remote & Sync"
          >
            <Github className="w-3.5 h-3.5 text-neutral-300" />
            <span className="hidden sm:inline">GitHub</span>
          </button>

          <button
            onClick={refreshGit}
            disabled={loading}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#2a2a2a] transition-colors"
            title="Refresh Git Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
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
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Changed Files Lists */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r border-[#2a2a2a]">
              {/* Staged Changes Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 tracking-wider uppercase">
                  <span className="flex items-center gap-1.5">
                    Staged Changes ({stagedCount})
                  </span>
                  {stagedCount > 0 && (
                    <button
                      onClick={handleUnstageAll}
                      disabled={actionLoading}
                      className="text-[11px] text-neutral-400 hover:text-white hover:underline flex items-center gap-1 lowercase"
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
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded bg-[#202020] hover:bg-[#282828] border border-transparent hover:border-[#3a3a3a] transition-colors text-xs"
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
                          <span className="font-mono truncate text-neutral-300 group-hover:text-white">{f.path}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleInspectDiff(f.path, true)}
                            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333]"
                            title="View Diff"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleUnstageFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded text-neutral-400 hover:text-amber-400 hover:bg-[#333333]"
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
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 tracking-wider uppercase">
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
                  <div className="text-[11px] text-neutral-500 italic py-1">
                    Working tree clean (no uncommitted changes)
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Unstaged tracked files */}
                    {status?.unstaged.map((f) => (
                      <div
                        key={f.path}
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded bg-[#202020] hover:bg-[#282828] border border-transparent hover:border-[#3a3a3a] transition-colors text-xs"
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
                          <span className="font-mono truncate text-neutral-300 group-hover:text-white">{f.path}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleInspectDiff(f.path, false)}
                            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333]"
                            title="View Diff"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDiscardFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-[#333333]"
                            title="Discard Changes"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleStageFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded text-neutral-400 hover:text-emerald-400 hover:bg-[#333333]"
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
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded bg-[#202020] hover:bg-[#282828] border border-transparent hover:border-[#3a3a3a] transition-colors text-xs"
                      >
                        <div 
                          onClick={() => handleInspectDiff(f.path, false)}
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="w-4 text-center font-mono font-bold text-[10px] text-emerald-400">
                            U
                          </span>
                          <span className="font-mono truncate text-neutral-300 group-hover:text-white">{f.path}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStageFile(f.path)}
                            disabled={actionLoading}
                            className="p-1 rounded text-neutral-400 hover:text-emerald-400 hover:bg-[#333333]"
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

            {/* Right: Commit Box */}
            <div className="w-full md:w-80 p-4 bg-[#1e1e1e] flex flex-col justify-between space-y-4">
              <form onSubmit={handleCommit} className="space-y-3 flex-1 flex flex-col">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Commit Message
                  </label>
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Enter commit message (e.g. Add collaborative editor sync)..."
                    rows={4}
                    className="w-full p-2.5 text-xs bg-[#141414] border border-[#333333] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 font-sans resize-none"
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        handleCommit();
                      }
                    }}
                  />
                  <span className="text-[10px] text-neutral-500">
                    Press <kbd className="bg-[#2a2a2a] px-1 py-0.5 rounded text-neutral-400">Ctrl+Enter</kbd> to commit
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="submit"
                    disabled={actionLoading || !commitMessage.trim() || stagedCount === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <GitCommitIcon className="w-4 h-4" />
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
                      className="w-full text-center text-xs text-neutral-400 hover:text-white hover:underline py-1"
                    >
                      Stage all changes & commit
                    </button>
                  )}

                  {/* Push Changes to Remote Button */}
                  <div className="pt-2 border-t border-[#333333]">
                    <button
                      type="button"
                      onClick={handleDirectPush}
                      disabled={syncing !== null}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                        status && status.ahead > 0
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                          : 'bg-[#2a2a2a] hover:bg-[#333333] text-neutral-300 border border-[#3c3c3c]'
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
                </div>
              </form>

              {/* Working Tree Summary Indicator */}
              <div className="p-3 rounded-lg bg-[#252526] border border-[#333333] space-y-1.5 text-[11px] text-neutral-400">
                <div className="flex justify-between">
                  <span>Author:</span>
                  <span className="text-neutral-200 font-medium">{userName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Branch:</span>
                  <span className="text-sky-400 font-mono font-medium">{currentBranch}</span>
                </div>
                {status?.lastCommit && (
                  <div className="border-t border-[#333333] pt-1.5 mt-1.5">
                    <span className="text-neutral-500 block">Last Commit:</span>
                    <span className="text-neutral-300 truncate block font-medium">
                      {status.lastCommit.message}
                    </span>
                    <span className="text-neutral-500 text-[10px]">
                      {status.lastCommit.author} • {status.lastCommit.relativeDate}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subtab 2: Commit History */}
        {activeSubTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4">
            {commits.length === 0 ? (
              <div className="p-8 text-center text-neutral-500 text-xs">
                No commits found in this repository yet. Stage changes and make your first commit!
              </div>
            ) : (
              <div className="space-y-2">
                {commits.map((c) => (
                  <div
                    key={c.fullHash}
                    onClick={() => handleInspectCommitDiff(c)}
                    className="p-3 rounded-xl bg-[#202020] hover:bg-[#262626] border border-[#2f2f2f] hover:border-sky-500/40 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-1 min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <GitCommitIcon className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                        <span className="font-semibold text-xs text-white truncate">{c.message}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-neutral-500" />
                          {c.author}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          {c.relativeDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-neutral-400 bg-[#161616] px-2 py-1 rounded border border-[#333333]">
                        {c.hash}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
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
                <h3 className="text-sm font-semibold text-white">Repository Branches</h3>
                <p className="text-xs text-neutral-400">Create, switch, merge and manage your workspace branches</p>
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
              <form onSubmit={handleCreateBranch} className="p-3.5 rounded-xl bg-[#222222] border border-[#333333] flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. feature/authentication or bugfix/header"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-[#181818] border border-[#3c3c3c] rounded-lg text-white focus:outline-none focus:border-sky-500 font-mono"
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
                  className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </form>
            )}

            {/* Merge Branch Bar */}
            <div className="p-4 rounded-xl bg-[#202020] border border-[#333333] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <GitMerge className="w-4 h-4 text-emerald-400" />
                  <span>Merge into {currentBranch}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMergeBranch}
                  onChange={(e) => setSelectedMergeBranch(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-[#181818] border border-[#3c3c3c] rounded-lg text-white focus:outline-none font-mono"
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
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">All Branches</h4>
              <div className="space-y-1.5">
                {branches.map((b) => (
                  <div
                    key={b.name}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${
                      b.isCurrent
                        ? 'bg-sky-950/30 border-sky-500/40 text-sky-200 font-semibold'
                        : 'bg-[#202020] border-[#2e2e2e] text-neutral-300 hover:border-[#404040]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <GitBranch className={`w-4 h-4 ${b.isCurrent ? 'text-sky-400' : 'text-neutral-500'}`} />
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
                            className="px-2.5 py-1 rounded bg-[#2a2a2a] hover:bg-[#333333] text-neutral-300 hover:text-white border border-[#3c3c3c] text-[11px] transition-colors"
                          >
                            Switch
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b.name)}
                            disabled={actionLoading}
                            className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-[#2a2a2a] transition-colors"
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
