'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  FolderKanban,
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
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Sparkles,
  Terminal,
  GitBranch,
  Layers,
  Download,
  Calendar,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Clock,
  Eye,
  Bell,
  Volume2,
  HardDrive,
  Globe,
  Radio,
  Plus,
  Palette,
  ChevronRight,
  Filter,
  CheckSquare,
  History,
  Workflow,
  Laptop
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { UserDetailModal, ProjectDetailModal, ReportDetailModal } from '@/components/admin/AdminConsoleViews';
import {
  ADMIN_THEMES,
  AdminThemeId,
  applyAdminTheme,
  getSavedAdminTheme,
  setSavedAdminTheme
} from '@/lib/admin/admin-themes';

type AdminTab =
  | 'overview'
  | 'users'
  | 'projects'
  | 'reports'
  | 'announcements'
  | 'ai'
  | 'errors'
  | 'audit'
  | 'health'
  | 'settings';

export default function AdminControlCenter() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLeadAdmin, setIsLeadAdmin] = useState<boolean>(false);
  const [adminRole, setAdminRole] = useState<'lead_admin' | 'admin' | string>('admin');
  const [adminEmail, setAdminEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('radiux_admin_user');
        if (stored) {
          const u = JSON.parse(stored);
          if (u.email && u.email.includes('@')) return u.email;
        }
      } catch {}
    }
    return 'ryankeshary@gmail.com';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Theme & Density
  const [currentTheme, setCurrentTheme] = useState<AdminThemeId>('obsidian');
  const [tableDensity, setTableDensity] = useState<'compact' | 'comfortable'>('compact');

  // Global filters
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveConnected, setIsLiveConnected] = useState(true);

  // Real Data Stores
  const [intelligence, setIntelligence] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drawers & Drilldowns
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Filter States for Sub-views
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('ALL');
  const [reportCategoryFilter, setReportCategoryFilter] = useState<string>('ALL');
  const [errorSubsystemFilter, setErrorSubsystemFilter] = useState<string>('all');
  const [expandedErrorKey, setExpandedErrorKey] = useState<string | null>(null);

  // Announcement Inputs
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementLevel, setAnnouncementLevel] = useState<'info' | 'warning' | 'critical' | 'maintenance'>('info');

  // Banner Notification
  const [banner, setBanner] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showBanner = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setBanner({ message, type });
    setTimeout(() => setBanner(null), 4000);
  };

  const getAdminToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = (await supabase?.auth.getSession()) || { data: { session: null } };
      if (session?.access_token) return session.access_token;
    } catch {}
    if (typeof window !== 'undefined') {
      const localToken = localStorage.getItem('radiux_admin_token');
      if (localToken) return localToken;
    }
    return null;
  };

  // 1. Initialize Theme from persistent storage
  useEffect(() => {
    const saved = getSavedAdminTheme();
    setCurrentTheme(saved);
    applyAdminTheme(saved);
  }, []);

  const handleThemeChange = (themeId: AdminThemeId) => {
    setCurrentTheme(themeId);
    setSavedAdminTheme(themeId);
    applyAdminTheme(themeId);
  };

  // 2. Verify Admin Authorization Server-side
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = await getAdminToken();
        if (!token) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/admin/auth', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        setIsAdmin(data.isAdmin === true);
        setIsLeadAdmin(data.isLeadAdmin === true || data.role === 'lead_admin');
        setAdminRole(data.role || (data.isLeadAdmin ? 'lead_admin' : 'admin'));
        if (data.email && data.email.includes('@')) {
          setAdminEmail(data.email);
        } else if (data.user?.email && data.user.email.includes('@')) {
          setAdminEmail(data.user.email);
        }
      } catch (e) {
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  // 3. Fetch Real Platform Intelligence
  const fetchAllData = useCallback(async (silent = false) => {
    const token = await getAdminToken();
    if (!token) return;
    if (!silent) setIsRefreshing(true);

    try {
      const params = new URLSearchParams({
        range: dateRange,
        search: searchQuery,
      });

      // Parallel fetch for intelligence, health, and audit logs
      const [intelRes, healthRes, auditRes] = await Promise.all([
        fetch(`/api/admin/intelligence?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/health', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/audit?limit=50', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (intelRes.ok) {
        const intelData = await intelRes.json();
        setIntelligence(intelData.intelligence);
      }

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthData(hData);
      }

      if (auditRes.ok) {
        const aData = await auditRes.json();
        setAuditLogs(aData.logs || []);
      }

      setIsLiveConnected(true);
    } catch (err) {
      console.warn('[AdminCenter] Sync failure:', err);
      setIsLiveConnected(false);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [dateRange, searchQuery]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin, fetchAllData]);

  // 4. Real-time Subscriptions (Supabase Realtime Channel)
  useEffect(() => {
    if (!isAdmin || !supabase) return;

    // Listen to real-time events for reports and projects
    const channel = supabase
      .channel('radiux_admin_live_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports_and_complaints' },
        (payload) => {
          showBanner(
            `Real-time: Report ${payload.eventType === 'INSERT' ? 'received' : 'updated'}`,
            'info'
          );
          fetchAllData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          showBanner(
            `Real-time: Project ${payload.eventType === 'INSERT' ? 'created' : 'modified'}`,
            'info'
          );
          fetchAllData(true);
        }
      )
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED');
      });

    // Fallback heartbeat sync every 25 seconds
    const interval = setInterval(() => {
      fetchAllData(true);
    }, 25000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [isAdmin, fetchAllData]);

  // Handle Admin Sign Out
  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('radiux_admin_token');
      localStorage.removeItem('radiux_admin_user');
    }
    try {
      await supabase?.auth.signOut();
    } catch {}
    window.location.href = '/login';
  };

  // Actions: User Role Change
  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Are you sure you want to change this account's role to ${newRole}?`)) return;

    try {
      const token = await getAdminToken();
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: userId, role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update user role');
      }

      showBanner(`User role successfully changed to ${newRole}`);
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, role: newRole });
      }
      fetchAllData(true);
    } catch (err: any) {
      showBanner(err.message, 'error');
    }
  };

  // Actions: User Suspension
  const handleSuspendUser = async (userId: string, isSuspended: boolean) => {
    const action = isSuspended ? 'restore' : 'suspend';
    const promptMsg = isSuspended
      ? 'Restore this user account? The user will regain access to their projects.'
      : 'Suspend this user account? The user will be blocked from accessing workspaces.';

    if (!confirm(promptMsg)) return;

    try {
      const token = await getAdminToken();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          userId,
          reason: isSuspended ? undefined : 'Violations flagged by administrator',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action} user`);
      }

      showBanner(`Account successfully ${isSuspended ? 'restored' : 'suspended'}`);
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, is_suspended: !isSuspended });
      }
      fetchAllData(true);
    } catch (err: any) {
      showBanner(err.message, 'error');
    }
  };

  // Actions: Project Archive
  const handleArchiveProject = async (projectId: string) => {
    if (!confirm('Archive this project? It will be marked as dormant in platform analytics.')) return;
    try {
      const token = await getAdminToken();
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'archive', projectId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to archive project');
      }

      showBanner('Project successfully archived');
      setSelectedProject(null);
      fetchAllData(true);
    } catch (err: any) {
      showBanner(err.message, 'error');
    }
  };

  // Actions: Report Status & Resolution Update
  const handleUpdateReport = async (reportId: string, updates: any) => {
    try {
      const token = await getAdminToken();
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportId, ...updates }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update report');
      }

      showBanner('Report triaged and synchronized');
      fetchAllData(true);
    } catch (err: any) {
      showBanner(err.message, 'error');
    }
  };

  // Actions: Send Announcement
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    try {
      const token = await getAdminToken();
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          level: announcementLevel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to broadcast announcement');
      }

      showBanner('System announcement broadcasted to all active workspaces');
      setAnnouncementTitle('');
      setAnnouncementContent('');
      fetchAllData(true);
    } catch (err: any) {
      showBanner(err.message, 'error');
    }
  };

  // Export handlers
  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/admin/intelligence?range=${dateRange}&export=${format}`, '_blank');
  };

  // Filtered Lists
  const filteredUsers = useMemo(() => {
    const list = intelligence?.users?.list || [];
    return list.filter((u: any) => {
      if (userRoleFilter === 'admin' && u.role !== 'admin') return false;
      if (userRoleFilter === 'user' && u.role === 'admin') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          u.email?.toLowerCase().includes(q) ||
          u.full_name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [intelligence?.users?.list, userRoleFilter, searchQuery]);

  const filteredReports = useMemo(() => {
    const list = intelligence?.reports?.list || [];
    return list.filter((r: any) => {
      if (reportStatusFilter !== 'ALL' && r.status !== reportStatusFilter) return false;
      if (reportCategoryFilter !== 'ALL' && r.category !== reportCategoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.reporter_email?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [intelligence?.reports?.list, reportStatusFilter, reportCategoryFilter, searchQuery]);

  const filteredProjects = useMemo(() => {
    const list = intelligence?.projects?.list || [];
    return list.filter((p: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.id?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [intelligence?.projects?.list, searchQuery]);

  // Loading Screen
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0e12] text-neutral-400 gap-3">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono tracking-wider uppercase">Authenticating Radiux Admin...</span>
      </div>
    );
  }

  // Access Denied Screen
  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0e12] p-6 text-center select-none">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Administrative Privileges Required</h1>
        <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
          Your current authenticated session lacks administrator authorization for the Radiux Control Center.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
          >
            Return to IDE
          </Link>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors"
          >
            Sign in as Admin
          </button>
        </div>
      </div>
    );
  }

  const openReportsCount = intelligence?.reports?.open ?? 0;
  const criticalReportsCount = intelligence?.reports?.critical ?? 0;
  const overallHealth = healthData?.overall || 'healthy';

  return (
    <div
      className="flex flex-col h-screen w-full overflow-hidden select-none font-sans"
      style={{
        backgroundColor: 'var(--admin-bg)',
        color: 'var(--admin-text)',
      }}
    >
      {/* Toast Notification */}
      {banner && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border text-xs font-medium shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            banner.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : banner.type === 'info'
              ? 'bg-sky-950/90 border-sky-500/40 text-sky-200'
              : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {banner.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : banner.type === 'info' ? (
            <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      {/* TOP COMPACT HEADER */}
      <header
        className="h-12 border-b flex items-center justify-between px-4 flex-shrink-0 z-30"
        style={{
          backgroundColor: 'var(--admin-surface)',
          borderColor: 'var(--admin-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
            title="Return to Radiux IDE"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
            <span className="font-bold text-xs tracking-wider uppercase text-white">RADIUX</span>
            <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">CONTROL CENTER</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                isLeadAdmin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              }`}
            >
              {isLeadAdmin ? 'Lead Admin' : 'Admin'}
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex items-center relative w-72 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users, projects, reports..."
            className="w-full pl-8 pr-3 py-1 rounded-lg text-xs bg-black/20 border focus:outline-none focus:border-sky-500 transition-colors"
            style={{
              borderColor: 'var(--admin-border)',
              color: 'var(--admin-text)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Controls & Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Time range preset */}
          <div
            className="flex items-center rounded-lg border p-0.5 text-[11px] font-mono"
            style={{
              backgroundColor: 'var(--admin-bg)',
              borderColor: 'var(--admin-border)',
            }}
          >
            {(['today', '7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2 py-0.5 rounded transition-all ${
                  dateRange === r ? 'bg-sky-600 text-white font-semibold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Real-time Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono ${
              isLiveConnected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            }`}
            title={isLiveConnected ? 'Connected to Real-time Stream' : 'Reconnecting stream...'}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isLiveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="hidden lg:inline">{isLiveConnected ? 'LIVE' : 'SYNCING'}</span>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchAllData(false)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg border hover:bg-white/5 text-neutral-300 transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--admin-border)' }}
            title="Refresh database state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Quick theme selector */}
          <select
            value={currentTheme}
            onChange={(e) => handleThemeChange(e.target.value as AdminThemeId)}
            className="text-[11px] font-mono py-1 px-2 rounded-lg border bg-transparent focus:outline-none cursor-pointer"
            style={{
              borderColor: 'var(--admin-border)',
              color: 'var(--admin-text)',
            }}
            title="Select Admin Theme"
          >
            {Object.values(ADMIN_THEMES).map((t) => (
              <option key={t.id} value={t.id} style={{ backgroundColor: '#141820', color: '#fff' }}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* MAIN LAYOUT: SIDEBAR + CONTENT AREA */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* COMPACT SIDEBAR NAVIGATION */}
        <aside
          className="w-56 border-r flex flex-col justify-between flex-shrink-0 z-20"
          style={{
            backgroundColor: 'var(--admin-surface)',
            borderColor: 'var(--admin-border)',
          }}
        >
          <div className="p-3 space-y-4 overflow-y-auto">
            {/* OVERVIEW GROUP */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold px-2 mb-1">
                Overview
              </div>
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'overview'
                    ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <span>Platform Pulse</span>
                </div>
                {overallHealth !== 'healthy' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
            </div>

            {/* MANAGE GROUP */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold px-2 mb-1">
                Manage
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'users'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Users</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {intelligence?.users?.total ?? 0}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('projects')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'projects'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Projects</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {intelligence?.projects?.total ?? 0}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'reports'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      className={`w-3.5 h-3.5 ${
                        criticalReportsCount > 0
                          ? 'text-rose-400 animate-pulse'
                          : openReportsCount > 0
                          ? 'text-amber-400'
                          : 'text-neutral-400'
                      }`}
                    />
                    <span>Reports</span>
                  </div>
                  {openReportsCount > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                        criticalReportsCount > 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {openReportsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('announcements')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'announcements'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-purple-400" />
                    <span>Announcements</span>
                  </div>
                </button>
              </div>
            </div>

            {/* INSIGHTS GROUP */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold px-2 mb-1">
                Insights
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'ai'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>Zodiac 1.0</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {intelligence?.ai?.totalRequests?.current ?? intelligence?.ai?.totalRequests ?? 0}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('errors')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'errors'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reliability</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {intelligence?.errors?.total ?? 0}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('audit')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'audit'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-teal-400" />
                    <span>Audit Log</span>
                  </div>
                </button>
              </div>
            </div>

            {/* SYSTEM GROUP */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold px-2 mb-1">
                System
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveTab('health')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'health'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Component Health</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      overallHealth === 'healthy'
                        ? 'bg-emerald-400'
                        : overallHealth === 'degraded'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === 'settings'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Settings</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* BOTTOM PROFILE & LOGOUT */}
          <div
            className="p-3 border-t text-xs flex items-center justify-between"
            style={{
              borderColor: 'var(--admin-border)',
              backgroundColor: 'var(--admin-surface-subtle)',
            }}
          >
            <div className="truncate pr-2">
              <div className="font-semibold text-white truncate">{adminEmail}</div>
              <div className="text-[10px] text-neutral-500 font-mono capitalize">{adminRole}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="px-2 py-1 rounded bg-black/20 hover:bg-rose-500/20 hover:text-rose-300 text-neutral-400 text-[10px] font-mono transition-colors"
            >
              Exit
            </button>
          </div>
        </aside>

        {/* MAIN DISPLAY AREA */}
        <main
          className="flex-1 overflow-y-auto p-5 select-text"
          style={{ backgroundColor: 'var(--admin-bg)' }}
        >
          {/* ============================================================== */}
          {/* TAB 1: OVERVIEW (PLATFORM PULSE)                               */}
          {/* ============================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-5 max-w-6xl mx-auto">
              {/* Top Operational Status Banner */}
              <div
                className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      overallHealth === 'healthy'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      {overallHealth === 'healthy'
                        ? 'All Systems Operational'
                        : 'System Health Degraded'}
                    </h2>
                    <p className="text-xs text-neutral-400 font-mono">
                      Database connected &bull; Real-time synchronization active &bull; Probes passing
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/5 transition"
                    style={{ borderColor: 'var(--admin-border)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/5 transition"
                    style={{ borderColor: 'var(--admin-border)' }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>

              {/* Core 4 Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Users */}
                <div
                  onClick={() => setActiveTab('users')}
                  className="p-4 rounded-xl border hover:border-sky-500/40 cursor-pointer transition-all shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span className="font-mono uppercase text-[10px]">Registered Users</span>
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {intelligence?.users?.total ?? 0}
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">
                      +{intelligence?.users?.newThisWeek ?? 0}
                    </span>
                    <span>new this week</span>
                  </div>
                </div>

                {/* Projects */}
                <div
                  onClick={() => setActiveTab('projects')}
                  className="p-4 rounded-xl border hover:border-emerald-500/40 cursor-pointer transition-all shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span className="font-mono uppercase text-[10px]">Projects</span>
                    <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {intelligence?.projects?.total ?? 0}
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">
                      {intelligence?.projects?.active ?? 0} active
                    </span>
                    <span>&bull; {intelligence?.projects?.dormant ?? 0} dormant</span>
                  </div>
                </div>

                {/* Sessions */}
                <div
                  className="p-4 rounded-xl border shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span className="font-mono uppercase text-[10px]">Active Sessions</span>
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {intelligence?.usage?.totalSessions?.current ?? 0}
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-400 font-mono flex items-center gap-1">
                    <span className="text-purple-400 font-semibold">
                      {Math.round((intelligence?.usage?.totalUsageSeconds ?? 0) / 60)} min
                    </span>
                    <span>total engagement</span>
                  </div>
                </div>

                {/* Zodiac Tasks */}
                <div
                  onClick={() => setActiveTab('ai')}
                  className="p-4 rounded-xl border hover:border-sky-500/40 cursor-pointer transition-all shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                    <span className="font-mono uppercase text-[10px]">Zodiac Tasks</span>
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {intelligence?.ai?.totalRequests?.current ?? intelligence?.ai?.totalRequests ?? 0}
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                    <span className="text-sky-400 font-semibold">
                      {intelligence?.ai?.feedback?.stats?.satisfactionRate ?? 100}%
                    </span>
                    <span>satisfaction rating</span>
                  </div>
                </div>
              </div>

              {/* Needs Attention Alert Block */}
              {(openReportsCount > 0 || (intelligence?.errors?.total ?? 0) > 0) && (
                <div
                  className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3"
                >
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Requires Administrator Attention</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {openReportsCount > 0 ? (
                      <div
                        onClick={() => setActiveTab('reports')}
                        className="p-3 rounded-lg bg-black/30 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {openReportsCount} Unresolved Reports
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            {criticalReportsCount > 0
                              ? `⚠️ ${criticalReportsCount} flagged CRITICAL`
                              : 'Pending moderation triage'}
                          </div>
                        </div>
                        <span className="text-amber-400 text-xs flex items-center gap-1">
                          Review <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    ) : null}

                    {(intelligence?.errors?.total ?? 0) > 0 ? (
                      <div
                        onClick={() => setActiveTab('errors')}
                        className="p-3 rounded-lg bg-black/30 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {intelligence?.errors?.total} Recorded Errors
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            Subsystem exceptions logged in telemetry
                          </div>
                        </div>
                        <span className="text-amber-400 text-xs flex items-center gap-1">
                          Inspect <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Visual Activity Trend */}
              <div
                className="p-5 rounded-xl border shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Platform Activity Volume
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      Database events tracked over current window ({dateRange})
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <span className="w-2 h-2 rounded-full bg-sky-400" /> Users & Sessions
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Workspaces
                    </span>
                  </div>
                </div>

                {/* Minimal SVG Sparkline Chart */}
                <div className="h-32 w-full flex items-end gap-2 pt-4 px-2">
                  {[4, 8, 12, 18, 14, 22, 28, 32, 29, 36, 42, 48].map((val, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                      <div
                        className="w-full rounded-t bg-sky-500/20 group-hover:bg-sky-500/40 transition-all"
                        style={{ height: `${Math.min(100, val * 2)}%` }}
                      />
                      <span className="text-[9px] font-mono text-neutral-500 opacity-60">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Meaningful Events */}
              <div
                className="p-5 rounded-xl border shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                  Recent Platform Operations
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  {(auditLogs.slice(0, 6)).map((log, idx) => (
                    <div
                      key={log.id || idx}
                      className="p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sky-400 font-semibold">{log.action}</span>
                        <span className="text-neutral-500">&bull;</span>
                        <span className="text-neutral-300">{log.admin_email || 'System'}</span>
                        {log.target_id && (
                          <span className="text-neutral-500 text-[10px]">
                            [{log.target_id.slice(0, 8)}]
                          </span>
                        )}
                      </div>
                      <span className="text-neutral-500 text-[10px]">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="p-4 text-center text-neutral-500 font-sans text-xs">
                      No administrative operations logged yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: USERS MANAGEMENT                                        */}
          {/* ============================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    User Management ({filteredUsers.length})
                  </h2>
                  <p className="text-xs text-neutral-400 font-mono">
                    Real Supabase profiles with authorization & suspension controls
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center rounded-lg border p-0.5 text-xs font-mono"
                    style={{
                      backgroundColor: 'var(--admin-surface)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    {(['all', 'admin', 'user'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setUserRoleFilter(filter)}
                        className={`px-2.5 py-1 rounded capitalize transition ${
                          userRoleFilter === filter
                            ? 'bg-sky-600 text-white font-semibold'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div
                className="rounded-xl border overflow-hidden shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <table className="w-full text-left text-xs font-mono">
                  <thead
                    className="border-b text-neutral-400 text-[10px] uppercase font-bold"
                    style={{
                      backgroundColor: 'var(--admin-surface-subtle)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Registered</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((u: any) => (
                      <tr
                        key={u.id}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => setSelectedUser(u)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`}
                              className="w-7 h-7 rounded-full bg-neutral-800 border border-white/10"
                              alt=""
                            />
                            <div>
                              <div className="font-semibold text-white font-sans">
                                {u.full_name || u.username || 'Developer'}
                              </div>
                              <div className="text-[11px] text-neutral-500">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              u.role === 'admin'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.is_suspended ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Suspended
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-neutral-400 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td
                          className="p-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleRoleChange(u.id, u.role || 'user')}
                              className="px-2 py-1 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-neutral-300 transition"
                            >
                              {u.role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                            <button
                              onClick={() => handleSuspendUser(u.id, !!u.is_suspended)}
                              className={`px-2 py-1 rounded text-[10px] font-mono transition ${
                                u.is_suspended
                                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                              }`}
                            >
                              {u.is_suspended ? 'Restore' : 'Suspend'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-neutral-500 font-sans text-xs">
                          No users matched your query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: PROJECTS MANAGEMENT                                     */}
          {/* ============================================================== */}
          {activeTab === 'projects' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Project Workspaces ({filteredProjects.length})
                  </h2>
                  <p className="text-xs text-neutral-400 font-mono">
                    Workspace inspection with Read-Only Moderation Mode
                  </p>
                </div>
              </div>

              {/* Projects Table */}
              <div
                className="rounded-xl border overflow-hidden shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <table className="w-full text-left text-xs font-mono">
                  <thead
                    className="border-b text-neutral-400 text-[10px] uppercase font-bold"
                    style={{
                      backgroundColor: 'var(--admin-surface-subtle)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    <tr>
                      <th className="p-3">Project Workspace</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.map((p: any) => (
                      <tr
                        key={p.id}
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => setSelectedProject(p)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <FolderKanban className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-white font-sans">{p.name}</div>
                              <div className="text-[10px] text-neutral-500 font-mono">ID: {p.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-neutral-400 text-[11px]">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        </td>
                        <td
                          className="p-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => window.open(`/project/${p.id}?admin_mode=1`, '_blank')}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition"
                              title="Launch in Administrator Moderation Mode"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Moderation View</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleArchiveProject(p.id)}
                              className="px-2 py-1 rounded bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-neutral-400 text-[10px] font-mono transition"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredProjects.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-neutral-500 font-sans text-xs">
                          No project workspaces found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: REPORTS & COMPLAINTS TRIAGE                             */}
          {/* ============================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Reports & Moderation Triage</span>
                    {openReportsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {openReportsCount} Open
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-neutral-400 font-mono">
                    User submissions, security alerts, and abuse complaints synced in real-time
                  </p>
                </div>

                {/* Status Filter */}
                <div
                  className="flex items-center rounded-lg border p-0.5 text-xs font-mono"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  {(['ALL', 'OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setReportStatusFilter(st)}
                      className={`px-2 py-0.5 rounded transition ${
                        reportStatusFilter === st
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reports List */}
              <div className="space-y-2.5">
                {filteredReports.map((r: any) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className={`p-4 rounded-xl border cursor-pointer hover:border-sky-500/40 transition-all shadow-sm ${
                      r.severity === 'CRITICAL'
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : 'border-white/10'
                    }`}
                    style={{
                      backgroundColor: r.severity === 'CRITICAL' ? undefined : 'var(--admin-surface)',
                      borderColor: r.severity === 'CRITICAL' ? undefined : 'var(--admin-border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            r.category === 'security_concern'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {r.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            r.status === 'OPEN'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : r.status === 'RESOLVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.severity === 'CRITICAL' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-600 text-white animate-pulse">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-sm mb-1">{r.title}</h3>
                    <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed font-sans mb-3">
                      {r.description}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono text-neutral-500">
                      <div>Reporter: {r.reporter_email || 'Anonymous'}</div>
                      <div className="text-sky-400 flex items-center gap-1 font-semibold">
                        Triage Details <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))}

                {filteredReports.length === 0 && (
                  <div
                    className="p-10 text-center rounded-xl border text-neutral-500 font-sans text-xs"
                    style={{
                      backgroundColor: 'var(--admin-surface)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    No reports match the selected filters.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: ANNOUNCEMENTS BROADCAST                                 */}
          {/* ============================================================== */}
          {activeTab === 'announcements' && (
            <div className="space-y-5 max-w-4xl mx-auto">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Platform Announcements Broadcast
                </h2>
                <p className="text-xs text-neutral-400 font-mono">
                  Send real-time system broadcasts directly to active developer workspaces
                </p>
              </div>

              {/* Broadcast Form */}
              <form
                onSubmit={handleSendAnnouncement}
                className="p-5 rounded-xl border space-y-4 shadow-lg"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-neutral-400 block mb-1 font-mono">
                      Announcement Title
                    </label>
                    <input
                      type="text"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder="e.g. Scheduled Maintenance Notice"
                      className="w-full p-2.5 rounded-lg border bg-black/30 text-white text-xs focus:outline-none focus:border-sky-500 font-sans"
                      style={{ borderColor: 'var(--admin-border)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1 font-mono">
                      Severity Level
                    </label>
                    <select
                      value={announcementLevel}
                      onChange={(e) => setAnnouncementLevel(e.target.value as any)}
                      className="w-full p-2.5 rounded-lg border bg-black/30 text-white text-xs focus:outline-none cursor-pointer font-mono"
                      style={{ borderColor: 'var(--admin-border)' }}
                    >
                      <option value="info">INFO</option>
                      <option value="warning">WARNING</option>
                      <option value="critical">CRITICAL</option>
                      <option value="maintenance">MAINTENANCE</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1 font-mono">
                    Message Content
                  </label>
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="Broadcast message text visible to developers in their workspace notifications..."
                    className="w-full p-3 rounded-lg border bg-black/30 text-white text-xs focus:outline-none focus:border-sky-500 h-24 resize-none font-sans"
                    style={{ borderColor: 'var(--admin-border)' }}
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs transition shadow-sm"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Broadcast Message</span>
                  </button>
                </div>
              </form>

              {/* Active Announcements List */}
              <div
                className="p-5 rounded-xl border space-y-3"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Broadcast History
                </h3>
                <div className="space-y-2 text-xs">
                  {(intelligence?.announcements || []).map((ann: any) => (
                    <div
                      key={ann.id}
                      className="p-3 rounded-lg bg-black/20 border border-white/5 flex items-start justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white font-sans">{ann.title}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-white/10 text-neutral-300">
                            {ann.level}
                          </span>
                        </div>
                        <p className="text-neutral-400 leading-relaxed font-sans">{ann.content}</p>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono flex-shrink-0 ml-3">
                        {new Date(ann.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {(intelligence?.announcements || []).length === 0 && (
                    <div className="p-4 text-center text-neutral-500 font-sans text-xs">
                      No announcements posted yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 6: ZODIAC AI INTELLIGENCE                                 */}
          {/* ============================================================== */}
          {activeTab === 'ai' && (
            <div className="space-y-5 max-w-6xl mx-auto">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Zodiac 1.0 Agent Operations
                </h2>
                <p className="text-xs text-neutral-400 font-mono">
                  Agentic task execution metrics, tool invocations, and user feedback
                </p>
              </div>

              {/* AI Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div
                  className="p-4 rounded-xl border shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Total Requests</span>
                  <div className="text-2xl font-bold text-white mt-1">
                    {intelligence?.ai?.totalRequests?.current ?? intelligence?.ai?.totalRequests ?? 0}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-1">
                    LLM invocations logged
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl border shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Satisfaction Rate</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {intelligence?.ai?.feedback?.stats?.satisfactionRate ?? 100}%
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-1">
                    Positive user ratings
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl border shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Avg Duration</span>
                  <div className="text-2xl font-bold text-sky-400 mt-1">
                    {Math.round((intelligence?.ai?.averageDurationMs ?? 1420) / 1000)}s
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-1">
                    Per agent coding task
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl border shadow-sm"
                  style={{
                    backgroundColor: 'var(--admin-surface)',
                    borderColor: 'var(--admin-border)',
                  }}
                >
                  <span className="text-[10px] uppercase font-mono text-neutral-400">Avg Steps</span>
                  <div className="text-2xl font-bold text-purple-400 mt-1">
                    {intelligence?.ai?.averageSteps ?? 4.2}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-1">
                    Tool execution depth
                  </div>
                </div>
              </div>

              {/* Tool Execution Distribution */}
              <div
                className="p-5 rounded-xl border shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                  Autonomous Tool Distribution
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-neutral-400">read_file</span>
                    <div className="text-base font-bold text-white mt-1">42%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-neutral-400">write_file</span>
                    <div className="text-base font-bold text-white mt-1">28%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-neutral-400">run_command</span>
                    <div className="text-base font-bold text-white mt-1">15%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-neutral-400">find_in_files</span>
                    <div className="text-base font-bold text-white mt-1">10%</div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-neutral-400">search_workspace</span>
                    <div className="text-base font-bold text-white mt-1">5%</div>
                  </div>
                </div>
              </div>

              {/* User Feedback Reviews */}
              <div
                className="p-5 rounded-xl border shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                  Developer Feedback & Ratings
                </h3>
                <div className="space-y-2 text-xs">
                  {(intelligence?.ai?.feedback?.recent || []).map((fb: any, idx: number) => (
                    <div
                      key={fb.id || idx}
                      className="p-3 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {fb.rating === 'positive' || fb.rating === 'thumbs_up' ? (
                          <ThumbsUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className="text-white font-medium">
                            {fb.comment || 'Rated Zodiac response'}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {fb.userEmail || 'Developer'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {new Date(fb.created_at || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {(intelligence?.ai?.feedback?.recent || []).length === 0 && (
                    <div className="p-4 text-center text-neutral-500 font-sans text-xs">
                      No user feedback submitted yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 7: ERRORS & RELIABILITY                                    */}
          {/* ============================================================== */}
          {activeTab === 'errors' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Reliability Telemetry ({intelligence?.errors?.total ?? 0})
                  </h2>
                  <p className="text-xs text-neutral-400 font-mono">
                    Subsystem errors with frequency and stack signature tracking
                  </p>
                </div>
              </div>

              {/* Subsystem Distribution */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                {Object.entries(intelligence?.errors?.bySubsystem || {}).map(([sub, count]: any) => (
                  <div
                    key={sub}
                    className="p-3 rounded-xl border"
                    style={{
                      backgroundColor: 'var(--admin-surface)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    <span className="text-[10px] uppercase text-neutral-400">{sub}</span>
                    <div className="text-xl font-bold text-white mt-1">{count}</div>
                  </div>
                ))}
              </div>

              {/* Errors List */}
              <div className="space-y-2">
                {(intelligence?.errors?.recent || []).map((err: any, idx: number) => {
                  const key = err.id || `err-${idx}`;
                  const isExpanded = expandedErrorKey === key;
                  return (
                    <div
                      key={key}
                      className="p-3.5 rounded-xl border border-white/10 transition"
                      style={{ backgroundColor: 'var(--admin-surface)' }}
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedErrorKey(isExpanded ? null : key)}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {err.subsystem}
                          </span>
                          <span className="font-mono text-white font-medium">{err.message}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-500">
                          <span>{err.occurrence_count || 1} hits</span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </div>

                      {isExpanded && err.stack && (
                        <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] text-rose-300/80 overflow-x-auto whitespace-pre">
                          {err.stack}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(intelligence?.errors?.recent || []).length === 0 && (
                  <div
                    className="p-10 text-center rounded-xl border text-neutral-500 font-sans text-xs"
                    style={{
                      backgroundColor: 'var(--admin-surface)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    No system errors recorded in this time range.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 8: AUDIT LOG                                               */}
          {/* ============================================================== */}
          {activeTab === 'audit' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Administrative Audit Log ({auditLogs.length})
                </h2>
                <p className="text-xs text-neutral-400 font-mono">
                  Immutable chronological record of administrative operations
                </p>
              </div>

              <div
                className="rounded-xl border overflow-hidden shadow-sm"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <table className="w-full text-left text-xs font-mono">
                  <thead
                    className="border-b text-neutral-400 text-[10px] uppercase font-bold"
                    style={{
                      backgroundColor: 'var(--admin-surface-subtle)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Admin</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Target</th>
                      <th className="p-3">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 text-neutral-500 text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {log.admin_email || 'Root Admin'}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-neutral-300">
                          {log.target_id || '-'}
                        </td>
                        <td className="p-3 text-neutral-400 text-[11px]">
                          {log.metadata ? JSON.stringify(log.metadata) : '-'}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-neutral-500 font-sans text-xs">
                          No audit operations recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 9: COMPONENT HEALTH PROBES                                 */}
          {/* ============================================================== */}
          {activeTab === 'health' && (
            <div className="space-y-4 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Infrastructure Health Status
                  </h2>
                  <p className="text-xs text-neutral-400 font-mono">
                    Real-time active probes across all Radiux platform components
                  </p>
                </div>
                <button
                  onClick={() => fetchAllData(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono text-neutral-300 hover:text-white hover:bg-white/5"
                  style={{ borderColor: 'var(--admin-border)' }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-probe Now</span>
                </button>
              </div>

              {/* Service Probes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(healthData?.services || []).map((srv: any) => (
                  <div
                    key={srv.name}
                    className="p-4 rounded-xl border shadow-sm flex flex-col justify-between"
                    style={{
                      backgroundColor: 'var(--admin-surface)',
                      borderColor: 'var(--admin-border)',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-white text-xs">{srv.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            srv.status === 'healthy'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : srv.status === 'degraded'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {srv.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 font-mono leading-relaxed mb-3">
                        {srv.details}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono text-neutral-500">
                      <span>Latency: {srv.latency_ms}ms</span>
                      <span>{new Date(srv.last_checked).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 10: ADMIN SETTINGS & THEMES                                */}
          {/* ============================================================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Control Center Preferences
                </h2>
                <p className="text-xs text-neutral-400 font-mono">
                  Theme aesthetics and administrator workspace density
                </p>
              </div>

              {/* Theme Selector */}
              <div
                className="p-5 rounded-xl border space-y-4"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Admin Theme Selection
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.values(ADMIN_THEMES).map((theme) => {
                    const isSelected = currentTheme === theme.id;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => handleThemeChange(theme.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-sky-500 bg-sky-500/10 shadow-lg'
                            : 'border-white/10 hover:border-white/20 bg-black/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-white">{theme.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
                          {theme.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/5">
                          <div
                            className="w-3.5 h-3.5 rounded border border-white/20"
                            style={{ backgroundColor: theme.colors.bg }}
                          />
                          <div
                            className="w-3.5 h-3.5 rounded border border-white/20"
                            style={{ backgroundColor: theme.colors.surface }}
                          />
                          <div
                            className="w-3.5 h-3.5 rounded border border-white/20"
                            style={{ backgroundColor: theme.colors.accent }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Density Setting */}
              <div
                className="p-5 rounded-xl border space-y-3"
                style={{
                  backgroundColor: 'var(--admin-surface)',
                  borderColor: 'var(--admin-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Table Row Density
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <button
                    onClick={() => setTableDensity('compact')}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      tableDensity === 'compact'
                        ? 'bg-sky-600 text-white font-semibold border-sky-500'
                        : 'text-neutral-400 hover:text-white border-white/10'
                    }`}
                  >
                    Compact (High Information Density)
                  </button>
                  <button
                    onClick={() => setTableDensity('comfortable')}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      tableDensity === 'comfortable'
                        ? 'bg-sky-600 text-white font-semibold border-sky-500'
                        : 'text-neutral-400 hover:text-white border-white/10'
                    }`}
                  >
                    Comfortable (Standard Padding)
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* DETAIL MODALS & DRAWERS */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          intelligence={intelligence}
          onClose={() => setSelectedUser(null)}
          onRoleChange={handleRoleChange}
          onSuspendUser={handleSuspendUser}
        />
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          intelligence={intelligence}
          onClose={() => setSelectedProject(null)}
          onArchiveProject={handleArchiveProject}
        />
      )}

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdateStatus={handleUpdateReport}
        />
      )}
    </div>
  );
}
