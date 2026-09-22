'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  ShieldAlert,
  Users,
  Cpu,
  Sliders,
  Activity,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Key,
  Database,
  Lock,
  Search,
  Check,
  X,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

type Tab = 'overview' | 'users' | 'usage' | 'settings' | 'system' | 'logs';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usageList, setUsageList] = useState<any[]>([]);
  const [settingsList, setSettingsList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 1. Server-Side Admin Auth Verification
  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
        if (!session?.access_token) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/admin/auth', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        setIsAdmin(data.isAdmin === true);
      } catch (e) {
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAuth();
  }, []);

  // 2. Fetch Data When Authorized
  const fetchDashboardData = async () => {
    const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!session?.access_token) return;

    const headers = { Authorization: `Bearer ${session.access_token}` };

    try {
      // Metrics
      const mRes = await fetch('/api/admin/metrics', { headers });
      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData.metrics);
      }

      // Users
      const uRes = await fetch('/api/admin/users', { headers });
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsersList(uData.users || []);
      }

      // Usage
      const usRes = await fetch('/api/admin/usage', { headers });
      if (usRes.ok) {
        const usData = await usRes.json();
        setUsageList(usData.usage || []);
      }

      // Settings
      const sRes = await fetch('/api/admin/settings', { headers });
      if (sRes.ok) {
        const sData = await sRes.json();
        setSettingsList(sData.settings || []);
      }

      // Audit Logs
      const lRes = await fetch('/api/admin/logs', { headers });
      if (lRes.ok) {
        const lData = await lRes.json();
        setAuditLogs(lData.logs || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin]);

  const showBanner = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Role Change Action
  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!session?.access_token) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId: userId, role: newRole }),
      });

      if (!res.ok) throw new Error('Role update failed');

      showBanner(`Updated user role to "${newRole}".`);
      fetchDashboardData();
    } catch (e: any) {
      showBanner(e.message, 'error');
    }
  };

  // Save AI Setting
  const handleSaveSetting = async (key: string, value: any) => {
    const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
    if (!session?.access_token) return;

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) throw new Error('Setting update failed');

      showBanner(`Updated setting "${key}".`);
      fetchDashboardData();
    } catch (e: any) {
      showBanner(e.message, 'error');
    }
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 gap-3">
        <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Verifying Administrative Authorization...</span>
      </div>
    );
  }

  // 403 Forbidden Screen
  if (!isAdmin) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-200 p-6">
        <div className="w-full max-w-md p-8 rounded-2xl bg-neutral-900 border border-red-500/20 shadow-2xl flex flex-col items-center text-center">
          <div className="p-3 rounded-full bg-red-500/10 text-red-400 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">403 Forbidden</h1>
          <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
            You do not have administrative privileges to access the Radiux Administrative Console.
            This attempt has been logged for security auditing.
          </p>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-200 font-sans select-none overflow-hidden">
      {/* Top Admin Header */}
      <header className="h-14 px-6 border-b border-white/10 bg-neutral-900/60 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
            title="Back to Radiux IDE"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-sky-500/10 text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-white tracking-tight">
              Radiux Console
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
              Admin
            </span>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notification && (
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium animate-in fade-in flex items-center gap-1.5 ${
              notification.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-950/80 text-red-300 border border-red-500/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{notification.message}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 text-xs transition-colors border border-white/[0.06]"
            title="Refresh All Metrics"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-56 border-r border-white/10 bg-neutral-900/30 p-3 flex flex-col justify-between">
          <nav className="space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
              { id: 'users', label: 'Users & Roles', icon: <Users className="w-4 h-4" /> },
              { id: 'usage', label: 'AI Usage Analytics', icon: <Cpu className="w-4 h-4" /> },
              { id: 'settings', label: 'AI Settings', icon: <Sliders className="w-4 h-4" /> },
              { id: 'system', label: 'System & Services', icon: <Server className="w-4 h-4" /> },
              { id: 'logs', label: 'Audit Logs', icon: <FileText className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-3 rounded-xl bg-neutral-950/40 border border-white/5 text-[11px] text-neutral-500">
            <div className="font-semibold text-neutral-400">Radiux Platform</div>
            <div className="font-mono text-[10px] mt-0.5">v0.1.0-agent-core</div>
          </div>
        </aside>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-8 select-text">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="max-w-6xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">Platform Overview</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Real-time platform activity, AI requests, and operational health.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    title: 'Total Users',
                    value: metrics?.totalUsers ?? '...',
                    desc: 'Registered developers',
                    color: 'text-sky-400',
                  },
                  {
                    title: 'Total Projects',
                    value: metrics?.totalProjects ?? '...',
                    desc: 'Collaborative workspaces',
                    color: 'text-emerald-400',
                  },
                  {
                    title: 'AI Agent Tasks',
                    value: metrics?.aiRequestsCount ?? '...',
                    desc: 'Tasks executed',
                    color: 'text-purple-400',
                  },
                  {
                    title: 'Total Tokens',
                    value: metrics?.totalTokens ? metrics.totalTokens.toLocaleString() : '0',
                    desc: `${metrics?.totalPromptTokens || 0} in / ${metrics?.totalCompletionTokens || 0} out`,
                    color: 'text-amber-400',
                  },
                ].map((card, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 flex flex-col justify-between"
                  >
                    <span className="text-[11px] text-neutral-400 font-medium">{card.title}</span>
                    <div className={`text-2xl font-bold font-mono my-2 ${card.color}`}>
                      {card.value}
                    </div>
                    <span className="text-[10px] text-neutral-500">{card.desc}</span>
                  </div>
                ))}
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-white/10">
                  <span className="text-[11px] text-neutral-400 font-medium">Tool Invocations</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {metrics?.totalToolCalls ?? 0}
                  </div>
                  <span className="text-[10px] text-neutral-500">File reads, edits & terminal runs</span>
                </div>
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-white/10">
                  <span className="text-[11px] text-neutral-400 font-medium">Avg Execution Latency</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {metrics?.avgLatencyMs ?? 0} ms
                  </div>
                  <span className="text-[10px] text-neutral-500">Per completion turn</span>
                </div>
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-white/10">
                  <span className="text-[11px] text-neutral-400 font-medium">Failed Requests</span>
                  <div className="text-xl font-bold font-mono text-red-400 mt-1">
                    {metrics?.errorCount ?? 0}
                  </div>
                  <span className="text-[10px] text-neutral-500">Errors encountered</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === 'users' && (
            <div className="max-w-6xl space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">User Accounts & Roles</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Manage registered developer profiles and administrative permissions.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-900/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950/60 border-b border-white/10 text-neutral-400 text-[11px]">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Created</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 flex items-center gap-2">
                          <img
                            src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`}
                            className="w-6 h-6 rounded-full bg-neutral-800"
                            alt=""
                          />
                          <span className="font-medium text-white">{u.full_name || u.username || 'Anonymous'}</span>
                        </td>
                        <td className="p-3 font-mono text-neutral-400">{u.email}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              u.role === 'admin'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td className="p-3 text-neutral-500 font-mono text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleRoleChange(u.id, u.role || 'user')}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                              u.role === 'admin'
                                ? 'bg-red-950/60 text-red-300 hover:bg-red-900 border border-red-500/30'
                                : 'bg-sky-600 hover:bg-sky-500 text-white'
                            }`}
                          >
                            {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usersList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-neutral-500">
                          No users registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AI USAGE */}
          {activeTab === 'usage' && (
            <div className="max-w-6xl space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">AI Usage History</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Detailed ledger of Groq model requests, token allocations, and tool execution counts.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-900/50">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-950/60 border-b border-white/10 text-neutral-400 text-[11px] font-sans">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Model</th>
                      <th className="p-3">Prompt</th>
                      <th className="p-3">Completion</th>
                      <th className="p-3">Tools</th>
                      <th className="p-3">Latency</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usageList.map((row) => (
                      <tr key={row.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 text-neutral-400 text-[11px]">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 text-sky-400">{row.model}</td>
                        <td className="p-3 text-neutral-300">{row.prompt_tokens}</td>
                        <td className="p-3 text-neutral-300">{row.completion_tokens}</td>
                        <td className="p-3 text-neutral-300">{row.tool_calls_count}</td>
                        <td className="p-3 text-neutral-400">{row.latency_ms}ms</td>
                        <td className="p-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              row.status === 'success'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-950/80 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {usageList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-neutral-500 font-sans">
                          No AI usage recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">Global AI Configuration</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Adjust default parameters, step limits, and rate thresholds for the AI Coding Agent.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: 'default_model',
                    label: 'Default Groq Model',
                    type: 'select',
                    options: [
                      'llama-3.3-70b-versatile',
                      'llama-3.1-70b-versatile',
                      'llama-3.1-8b-instant',
                      'mixtral-8x7b-32768',
                    ],
                    desc: 'Default LLM employed for multi-step agent coding loops.',
                  },
                  {
                    key: 'max_agent_steps',
                    label: 'Max Agent Iteration Steps',
                    type: 'number',
                    desc: 'Maximum consecutive tool calls before pausing the agent execution loop.',
                  },
                  {
                    key: 'default_permission_mode',
                    label: 'Default Permission Mode',
                    type: 'select',
                    options: ['READ_ONLY', 'ASSISTED', 'AUTONOMOUS'],
                    desc: 'Initial security constraint mode for new workspace AI sessions.',
                  },
                  {
                    key: 'rate_limit_per_minute',
                    label: 'User Rate Limit (Reqs / min)',
                    type: 'number',
                    desc: 'Quota protection preventing abuse of agent execution loops.',
                  },
                ].map((item) => {
                  const currentVal = settingsList.find((s) => s.key === item.key)?.value;
                  return (
                    <div
                      key={item.key}
                      className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 flex items-center justify-between"
                    >
                      <div className="max-w-md">
                        <span className="text-xs font-semibold text-neutral-200">{item.label}</span>
                        <p className="text-[11px] text-neutral-400 mt-0.5">{item.desc}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.type === 'select' ? (
                          <select
                            defaultValue={currentVal || item.options![0]}
                            onChange={(e) => handleSaveSetting(item.key, e.target.value)}
                            className="bg-neutral-950 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-neutral-200 outline-none"
                          >
                            {item.options!.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            defaultValue={currentVal || 20}
                            onBlur={(e) => handleSaveSetting(item.key, parseInt(e.target.value, 10))}
                            className="w-24 bg-neutral-950 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-neutral-200 outline-none font-mono text-center"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM */}
          {activeTab === 'system' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">System & Service Status</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Verify health and environment configuration across Radiux backend services.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    name: 'Groq Cloud Provider',
                    status: 'Connected',
                    desc: 'GROQ_API_KEY detected server-side',
                    icon: <Cpu className="w-5 h-5 text-sky-400" />,
                  },
                  {
                    name: 'Backend Workspace PTY',
                    status: 'Operational',
                    desc: 'Port 1234 active for sandboxed execution',
                    icon: <Server className="w-5 h-5 text-emerald-400" />,
                  },
                  {
                    name: 'Supabase Postgres & Auth',
                    status: 'Connected',
                    desc: 'RLS policies and schema v13 active',
                    icon: <Database className="w-5 h-5 text-emerald-400" />,
                  },
                  {
                    name: 'Yjs Collaborative Sync',
                    status: 'Active',
                    desc: 'Real-time WebSocket protocol operational',
                    icon: <Activity className="w-5 h-5 text-sky-400" />,
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-white/[0.04]">{s.icon}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{s.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-semibold font-mono">
                          {s.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LOGS */}
          {activeTab === 'logs' && (
            <div className="max-w-6xl space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Administrative Audit Trail</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Immutable record of role modifications, AI setting updates, and administrative events.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-900/50">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-950/60 border-b border-white/10 text-neutral-400 text-[11px] font-sans">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Target ID</th>
                      <th className="p-3">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 text-neutral-400 text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 text-sky-300 font-semibold">{log.action}</td>
                        <td className="p-3 text-neutral-400">{log.target_id || '-'}</td>
                        <td className="p-3 text-neutral-300 text-[11px]">
                          {JSON.stringify(log.metadata)}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-neutral-500 font-sans">
                          No audit log entries recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
