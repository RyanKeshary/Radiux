'use client';

import React, { useState } from 'react';
import {
  Users,
  FolderKanban,
  Cpu,
  Sparkles,
  AlertTriangle,
  Server,
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Copy,
  Clock,
  CheckCircle2,
  XCircle,
  FileCode,
  Terminal,
  GitBranch,
  Layers,
  Search,
  Filter,
  Download,
  Calendar,
  ExternalLink,
  MessageSquare,
  Lock,
  ChevronRight,
  Eye,
  Check,
  X,
  Volume2,
  RefreshCw,
  Bell,
  Sliders,
} from 'lucide-react';

// ==========================================
// 1. User Detail Modal Drilldown
// ==========================================
export function UserDetailModal({
  user,
  intelligence,
  onClose,
  onRoleChange,
  onSuspendUser,
}: {
  user: any;
  intelligence: any;
  onClose: () => void;
  onRoleChange: (userId: string, currentRole: string) => void;
  onSuspendUser?: (userId: string, isSuspended: boolean) => void;
}) {
  const sessions = (intelligence?.usage?.recentSessions || []).filter((s: any) => s.user_id === user.id);
  const totalDuration = sessions.reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);
  const userProjects = (intelligence?.projects?.list || []).filter((p: any) => p.owner_id === user.id || p.user_id === user.id);
  const userFeedback = (intelligence?.ai?.feedback?.recent || []).filter((f: any) => f.userEmail === user.email);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <img
              src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
              className="w-10 h-10 rounded-full border border-white/10 bg-neutral-800"
              alt=""
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">{user.full_name || user.username || 'Developer'}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                    user.role === 'admin'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {user.role || 'user'}
                </span>
                {user.is_suspended && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Suspended
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 font-mono">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSuspendUser && (
              <button
                onClick={() => onSuspendUser(user.id, !!user.is_suspended)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  user.is_suspended
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                }`}
              >
                {user.is_suspended ? 'Restore Account' : 'Suspend Account'}
              </button>
            )}
            <button
              onClick={() => onRoleChange(user.id, user.role || 'user')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                user.role === 'admin'
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
            </button>
            <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs select-text">
          {/* Top Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">Sessions</span>
              <div className="text-lg font-bold text-white mt-1">{sessions.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">Usage Time</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">{Math.round(totalDuration / 60)} min</div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">Projects</span>
              <div className="text-lg font-bold text-sky-400 mt-1">{userProjects.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">AI Feedback</span>
              <div className="text-lg font-bold text-purple-400 mt-1">{userFeedback.length}</div>
            </div>
          </div>

          {/* Account & Profile Details */}
          <div className="p-4 rounded-xl bg-neutral-950/40 border border-white/5 space-y-2 font-mono">
            <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider font-sans">
              Identity Profile
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-400">
              <div>User ID: <span className="text-neutral-200">{user.id}</span></div>
              <div>Username: <span className="text-neutral-200">@{user.username || 'unassigned'}</span></div>
              <div>Registered: <span className="text-neutral-200">{new Date(user.created_at).toLocaleDateString()}</span></div>
              <div>Account Status: <span className="text-emerald-400 font-semibold">Active & Confirmed</span></div>
            </div>
          </div>

          {/* Projects Owned / Joined */}
          <div>
            <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Associated Projects ({userProjects.length})
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-950/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950/80 border-b border-white/10 text-neutral-400 text-[10px]">
                  <tr>
                    <th className="p-2.5">Project Name</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {userProjects.map((p: any) => (
                    <tr key={p.id}>
                      <td className="p-2.5 text-white font-medium">{p.name}</td>
                      <td className="p-2.5 text-neutral-400">Owner</td>
                      <td className="p-2.5 text-neutral-500">{new Date(p.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {userProjects.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-neutral-500 font-sans">
                        No projects created by this user yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Usage Sessions */}
          <div>
            <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Recorded User Sessions ({sessions.length})
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-950/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950/80 border-b border-white/10 text-neutral-400 text-[10px]">
                  <tr>
                    <th className="p-2.5">Started</th>
                    <th className="p-2.5">Duration</th>
                    <th className="p-2.5">Session Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sessions.slice(0, 5).map((s: any) => (
                    <tr key={s.id}>
                      <td className="p-2.5 text-neutral-300">{new Date(s.started_at).toLocaleString()}</td>
                      <td className="p-2.5 text-emerald-400">{Math.round((s.duration_seconds || 0) / 60)}m {((s.duration_seconds || 0) % 60)}s</td>
                      <td className="p-2.5 text-neutral-400">{s.session_type}</td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-neutral-500 font-sans">
                        No active sessions recorded for this user yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. Project Detail Modal Drilldown
// ==========================================
export function ProjectDetailModal({
  project,
  intelligence,
  onClose,
  onArchiveProject,
}: {
  project: any;
  intelligence: any;
  onClose: () => void;
  onArchiveProject?: (projectId: string) => void;
}) {
  const sessions = (intelligence?.usage?.recentSessions || []).filter((s: any) => s.project_id === project.id);
  const totalDuration = sessions.reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);
  const owner = (intelligence?.users?.list || []).find((u: any) => u.id === (project.owner_id || project.user_id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{project.name}</h3>
              <p className="text-xs text-neutral-400 font-mono">ID: {project.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(`/project/${project.id}?admin_mode=1`, '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition"
              title="Inspect Workspace and Chat in Read-Only Moderation Mode"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Moderation View</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            {onArchiveProject && (
              <button
                onClick={() => onArchiveProject(project.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition"
              >
                Archive Project
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs select-text">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">Owner</span>
              <div className="text-sm font-bold text-white mt-1 truncate">{owner?.full_name || owner?.email || 'Developer'}</div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">Created</span>
              <div className="text-sm font-bold text-neutral-300 mt-1">{new Date(project.created_at).toLocaleDateString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">Total Sessions</span>
              <div className="text-lg font-bold text-sky-400 mt-1">{sessions.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-white/5">
              <span className="text-[10px] text-neutral-400 uppercase font-mono">Active Usage Time</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">{Math.round(totalDuration / 60)} min</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/40 border border-white/5 space-y-2">
            <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
              Project Specification
            </div>
            <p className="text-neutral-400 leading-relaxed font-sans">
              {project.description || 'Collaborative workspace container with virtual file tree, terminal pty, and Zodiac 1.0 agent integration.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. Report Detail / Edit Modal
// ==========================================
export function ReportDetailModal({
  report,
  onClose,
  onUpdateStatus,
}: {
  report: any;
  onClose: () => void;
  onUpdateStatus: (id: string, updates: any) => void;
}) {
  const [status, setStatus] = useState(report.status);
  const [priority, setPriority] = useState(report.priority);
  const [notes, setNotes] = useState(report.internal_notes || '');
  const [resolution, setResolution] = useState(report.resolution || '');

  const handleSave = () => {
    onUpdateStatus(report.id, {
      status,
      priority,
      internal_notes: notes,
      resolution,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-neutral-950/60">
          <div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 uppercase font-bold">
              {report.category}
            </span>
            <h3 className="font-bold text-white text-base mt-1">{report.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs select-text">
          <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-white/5">
            <span className="text-[10px] text-neutral-500 uppercase font-mono">Description from Reporter:</span>
            <p className="text-neutral-200 mt-1 whitespace-pre-wrap leading-relaxed">{report.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2 rounded-lg bg-neutral-950 border border-white/10 text-white text-xs"
              >
                <option value="OPEN">OPEN</option>
                <option value="IN_REVIEW">IN_REVIEW</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full p-2 rounded-lg bg-neutral-950 border border-white/10 text-white text-xs"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Internal Admin Notes (Private)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private investigation notes visible only to admins..."
              className="w-full p-2.5 rounded-lg bg-neutral-950 border border-white/10 text-neutral-200 text-xs h-20 resize-none focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Resolution Summary</label>
            <input
              type="text"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="e.g. Rate limit backoff patched in groq-provider..."
              className="w-full p-2 rounded-lg bg-neutral-950 border border-white/10 text-neutral-200 text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors"
            >
              Update Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
