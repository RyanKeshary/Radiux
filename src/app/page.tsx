'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { Project } from '@/lib/types';
import { THEMES, ThemeId, applyThemeVariables } from '@/lib/themes';
import { UserMenu } from '@/components/auth/UserMenu';
import { AuthModal } from '@/components/auth/AuthModal';
import { useDebounce } from '@/hooks/useDebounce';

// Dynamically import heavy modals so they are loaded only when opened
const CreateProjectModal = dynamic(() => import('@/components/dashboard/CreateProjectModal').then(m => m.CreateProjectModal), { ssr: false });
const ImportProjectModal = dynamic(() => import('@/components/dashboard/ImportProjectModal').then(m => m.ImportProjectModal), { ssr: false });
const ImportWorkspaceModal = dynamic(() => import('@/components/dashboard/ImportWorkspaceModal').then(m => m.ImportWorkspaceModal), { ssr: false });
const NotificationCenterPanel = dynamic(() => import('@/components/workspace/NotificationCenterPanel').then(m => m.NotificationCenterPanel), { ssr: false });
const UserProfileModal = dynamic(() => import('@/components/workspace/UserProfileModal').then(m => m.UserProfileModal), { ssr: false });
const EditorSettingsModal = dynamic(() => import('@/components/workspace/EditorSettingsModal').then(m => m.EditorSettingsModal), { ssr: false });
const DeveloperDiscoveryModal = dynamic(() => import('@/components/profile/DeveloperDiscoveryModal').then(m => m.DeveloperDiscoveryModal), { ssr: false });
import type { EditorSettings } from '@/components/workspace/EditorSettingsModal';
import { 
  Code2, 
  FolderGit2, 
  Plus, 
  Clock, 
  ArrowRight,
  FileCode, 
  LogIn, 
  Upload, 
  Github,
  Mail, 
  FolderArchive, 
  Download,
  Search,
  Trash2,
  Palette,
  Play,
  Terminal,
  Layers,
  Keyboard,
  Command,
  ExternalLink,
  Bell,
  Users,
  Settings,
  User,
  Sparkles,
  Globe,
  Loader2
} from 'lucide-react';
import { soundManager } from '@/lib/sound';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithOAuth, isSupabase } = useAuth();
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportProjectOpen, setIsImportProjectOpen] = useState(false);
  const [isImportWorkspaceOpen, setIsImportWorkspaceOpen] = useState(false);
  const [exportingWorkspace, setExportingWorkspace] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'preferences' | 'partners' | 'account'>('profile');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Search & Filter State (debounced to avoid re-rendering on every keystroke)
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 150);
  const [filterType, setFilterType] = useState<'all' | 'owned' | 'shared'>('all');

  // Last opened workspace state for instant resume
  const [lastProject, setLastProject] = useState<{ id: string; name: string } | null>(null);

  // Theme & Editor Settings state
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('dark');
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    const defaults: EditorSettings = {
      theme: 'dark',
      fontSize: 14,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
      tabSize: 2,
      wordWrap: 'on',
      minimap: true,
      soundEnabled: true,
    };
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('radiux_editor_settings') || localStorage.getItem('codecollab_editor_settings');
        if (savedSettings) return { ...defaults, ...JSON.parse(savedSettings) };
      } catch (e) {}
    }
    return defaults;
  });

  // Deletion State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Initialize Theme from user preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('radiux_editor_settings') || localStorage.getItem('codecollab_editor_settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed.theme && THEMES[parsed.theme as ThemeId]) {
            setCurrentTheme(parsed.theme as ThemeId);
            applyThemeVariables(parsed.theme as ThemeId);
            return;
          }
        }
      } catch (e) {}
      applyThemeVariables('dark');
    }
  }, []);

  const handleThemeChange = (newTheme: ThemeId) => {
    setCurrentTheme(newTheme);
    applyThemeVariables(newTheme);
    handleUpdateSettings({ theme: newTheme });
  };

  const handleUpdateSettings = (newSettings: Partial<EditorSettings>) => {
    setEditorSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('radiux_editor_settings', JSON.stringify(updated));
          localStorage.setItem('codecollab_editor_settings', JSON.stringify(updated));
        } catch (e) {}
      }
      if (newSettings.theme && newSettings.theme !== currentTheme) {
        setCurrentTheme(newSettings.theme as ThemeId);
        applyThemeVariables(newSettings.theme as ThemeId);
      }
      if (typeof newSettings.soundEnabled === 'boolean') {
        soundManager.setEnabled(newSettings.soundEnabled);
      }
      return updated;
    });
  };

  // 2. Fetch Projects & Check Last Opened Project
  const fetchProjects = async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await DataService.getProjects(user.id);
      setProjects(data);

      // Load user notifications
      try {
        const notifs = await DataService.getNotifications(user.id);
        setNotifications(notifs.map(n => ({
          id: n.id,
          type: n.type as any,
          title: n.title,
          message: n.message,
          read: n.read,
          actionStatus: n.action_status,
          createdAt: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          projectId: n.project_id || n.data?.project_id,
          partnerRequestId: n.partner_request_id || n.data?.partner_request_id,
        })));
      } catch (e) {}

      if (typeof window !== 'undefined') {
        const lastId = localStorage.getItem('radiux_last_project_id') || localStorage.getItem('codecollab_last_project_id');
        const lastName = localStorage.getItem('radiux_last_project_name') || localStorage.getItem('codecollab_last_project_name');
        if (lastId && data.some(p => p.id === lastId)) {
          setLastProject({ id: lastId, name: lastName || 'Workspace' });
        } else if (data.length > 0) {
          setLastProject({ id: data[0].id, name: data[0].name });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  // 3. Keyboard Shortcuts for Dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New Project
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsModalOpen(true);
      }
      // Slash: focus search input if not in input
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        document.getElementById('workspace-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExportAllWorkspaces = async () => {
    if (!user) return;
    setExportingWorkspace(true);
    try {
      await DataService.exportCompleteWorkspace(user.id);
    } catch (e) {
      console.error('Export all failed:', e);
      alert('Failed to export workspace');
    } finally {
      setExportingWorkspace(false);
    }
  };

  const handleDeleteProjectConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteProject(projectToDelete.id);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      if (lastProject?.id === projectToDelete.id) {
        setLastProject(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('radiux_last_project_id');
          localStorage.removeItem('radiux_last_project_name');
          localStorage.removeItem('codecollab_last_project_id');
          localStorage.removeItem('codecollab_last_project_name');
        }
      }
      setProjectToDelete(null);
    } catch (err: any) {
      alert('Failed to delete workspace: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    let list = [...projects];

    if (filterType === 'owned') {
      list = list.filter(p => p.owner_id === user?.id);
    } else if (filterType === 'shared') {
      list = list.filter(p => p.owner_id !== user?.id);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Sort by recent updated by default
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [projects, filterType, debouncedSearch, user?.id]);

  return (
    <div 
      className="min-h-screen flex flex-col font-mono text-xs select-none"
      style={{
        backgroundColor: 'var(--ide-bg)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Top IDE Application Bar */}
      <header 
        className="h-12 border-b px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 flex-shrink-0 backdrop-blur-md transition-colors shadow-sm"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shadow-md ring-1 ring-white/15 bg-black/40">
            <img src="/logo.png" alt="Radiux" className="w-7 h-7 rounded-lg object-contain" />
          </div>
          <span className="font-bold tracking-tight text-[13px]" style={{ color: 'var(--ide-text)' }}>
            Radiux
          </span>
          <span className="opacity-30 text-xs">/</span>
          <span 
            className="px-2 py-0.5 rounded-md text-[10.5px] font-mono border"
            style={{
              borderColor: 'var(--ide-border)',
              backgroundColor: 'var(--ide-card-bg)',
              color: 'var(--ide-text-muted)',
            }}
          >
            Welcome
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct Navigation for Signed In Users */}
          {user && (
            <div className="flex items-center gap-1.5 mr-1">
              <Link
                href={`/profile/${user.username || user.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-transparent hover:border-white/10 hover:bg-white/5 transition-all flex items-center gap-1.5 group cursor-pointer"
                title="View My Developer Profile"
              >
                <User className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Profile</span>
              </Link>

              <button
                onClick={() => setIsCollaboratorsOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-transparent hover:border-white/10 hover:bg-white/5 transition-all flex items-center gap-1.5 group cursor-pointer"
                title="Discover Developers & Collaborators"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Collaborators</span>
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-transparent hover:border-white/10 hover:bg-white/5 transition-all flex items-center gap-1.5 group cursor-pointer"
                title="IDE & Editor Settings"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-45 transition-transform duration-300" />
                <span className="hidden sm:inline">Settings</span>
              </button>

              <button
                onClick={() => setIsNotificationsOpen(true)}
                className="p-1.5 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 relative transition-all text-amber-400 group cursor-pointer"
                title="Notification Center"
              >
                <Bell className="w-4 h-4 group-hover:scale-110 transition-transform" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center leading-none shadow ring-2 ring-[var(--ide-dock-header)] animate-pulse">
                    {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Theme Quick-Picker */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs shadow-sm transition-all hover:border-white/20"
            style={{
              borderColor: 'var(--ide-border)',
              backgroundColor: 'var(--ide-card-bg)',
            }}
          >
            <Palette className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <select
              value={currentTheme}
              onChange={(e) => handleThemeChange(e.target.value as ThemeId)}
              className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer pr-1"
              style={{
                color: 'var(--ide-text)',
              }}
              title="Select IDE Theme"
            >
              {Object.values(THEMES).map(t => (
                <option key={t.id} value={t.id} style={{ backgroundColor: 'var(--ide-card-bg)', color: 'var(--ide-text)' }}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <UserMenu 
            onViewPublicProfile={() => router.push('/profile/' + (user?.username || user?.id))}
            onOpenProfileModal={(tab) => {
              setProfileModalTab(tab || 'profile');
              setIsProfileModalOpen(true);
            }}
            onOpenPartnersModal={() => {
              setProfileModalTab('partners');
              setIsProfileModalOpen(true);
            }}
            onOpenSettingsModal={() => setIsSettingsOpen(true)}
            onOpenDiscoveryModal={() => setIsCollaboratorsOpen(true)}
          />
        </div>
      </header>

      {/* Main IDE Welcome Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10 flex flex-col justify-start">
        {!user && !authLoading ? (
          <div 
            className="p-8 rounded-2xl border my-auto text-center max-w-md mx-auto space-y-4 shadow-2xl"
            style={{
              backgroundColor: 'var(--ide-card-bg)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center mx-auto shadow-lg ring-1 ring-white/15 bg-black/40">
              <img src="/logo.png" alt="Radiux" className="w-14 h-14 rounded-xl object-contain" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Welcome to Radiux</h2>
              <p className="text-[11.5px] mt-1 opacity-70 leading-relaxed" style={{ color: 'var(--ide-text-muted)' }}>
                Cloud-based collaborative web IDE with real-time editing, terminal execution, Git sync, and multi-user presence.
              </p>
            </div>

            {/* Quick OAuth Buttons */}
            {isSupabase && (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    setOauthLoading('google');
                    const { error } = await signInWithOAuth('google');
                    if (error) setOauthLoading(null);
                  }}
                  disabled={oauthLoading !== null}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-semibold transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
                >
                  {oauthLoading === 'google' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-600" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOauthLoading('github');
                    const { error } = await signInWithOAuth('github');
                    if (error) setOauthLoading(null);
                  }}
                  disabled={oauthLoading !== null}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-[#24292e] hover:bg-[#2f363d] text-white text-xs font-semibold transition-all border border-[#3c3c3c] shadow-sm active:scale-[0.99] disabled:opacity-50"
                >
                  {oauthLoading === 'github' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Github className="w-4 h-4" />
                  )}
                  <span>Continue with GitHub</span>
                </button>

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10.5px] text-neutral-500 font-medium">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </div>
            )}

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Sign In with Email</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Resume Bar (if a recent project exists) */}
            {lastProject && (
              <div 
                className="p-3 rounded-lg border flex items-center justify-between gap-4 transition-all hover:border-sky-500/50"
                style={{
                  backgroundColor: 'var(--ide-card-bg)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">Recent Workspace</span>
                      <span className="opacity-40 text-[10px]">•</span>
                      <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--ide-text)' }}>
                        {lastProject.name}
                      </span>
                    </div>
                    <span className="text-[10px] opacity-60">Continue where you left off</span>
                  </div>
                </div>

                <Link
                  href={`/project/${lastProject.id}`}
                  className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center gap-1.5 flex-shrink-0 shadow-sm transition-colors"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* 2-Column Developer Layout (Start & Recent Workspaces) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column: Start Actions (4 cols) */}
              <div className="md:col-span-5 space-y-5">
                {/* Compact User Panel (Requirement 26) */}
                {user && (
                  <div 
                    className="p-3 rounded-xl border flex items-center justify-between gap-3 shadow-sm backdrop-blur-sm"
                    style={{
                      backgroundColor: 'var(--ide-card-bg)',
                      borderColor: 'var(--ide-border)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        {user.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt={user.full_name || 'User'} 
                            className="w-8 h-8 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-xs">
                            {(user.full_name || 'U')[0]}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-[var(--ide-card-bg)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
                          {user.full_name || 'Developer'}
                        </div>
                        <div className="text-[10px] opacity-60 font-mono truncate">
                          @{user.email.split('@')[0]}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className="p-1.5 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 text-sky-400 transition-colors"
                        title="View & Edit Profile"
                      >
                        <User className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsCollaboratorsOpen(true)}
                        className="p-1.5 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 text-emerald-400 transition-colors"
                        title="Discover Developers"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-1.5 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 text-indigo-400 transition-colors"
                        title="Settings"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsNotificationsOpen(true)}
                        className="p-1.5 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 text-amber-400 transition-colors relative"
                        title="Notification Center"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        {notifications.filter(n => !n.read).length > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 text-[8.5px] font-bold text-white bg-rose-500 rounded-full flex items-center justify-center leading-none">
                            {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                    Start
                  </h3>

                  <div className="space-y-1">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="w-full p-2.5 rounded border text-left flex items-center justify-between transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Plus className="w-4 h-4 text-sky-400" />
                        <span className="font-medium" style={{ color: 'var(--ide-text)' }}>New Project...</span>
                      </div>
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] opacity-50 border" style={{ borderColor: 'var(--ide-border)' }}>
                        Ctrl+N
                      </kbd>
                    </button>

                    <button
                      onClick={() => setIsImportProjectOpen(true)}
                      className="w-full p-2.5 rounded border text-left flex items-center justify-between transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Upload className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium" style={{ color: 'var(--ide-text)' }}>Clone or Import...</span>
                      </div>
                      <span className="text-[10px] opacity-50">Git / ZIP</span>
                    </button>

                    <button
                      onClick={() => setIsImportWorkspaceOpen(true)}
                      className="w-full p-2.5 rounded border text-left flex items-center justify-between transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <FolderArchive className="w-4 h-4 text-purple-400" />
                        <span className="font-medium" style={{ color: 'var(--ide-text)' }}>Restore Workspace Archive...</span>
                      </div>
                      <span className="text-[10px] opacity-50">Backup</span>
                    </button>

                    <button
                      onClick={handleExportAllWorkspaces}
                      disabled={exportingWorkspace || projects.length === 0}
                      className="w-full p-2.5 rounded border text-left flex items-center justify-between transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Download className="w-4 h-4 text-amber-400" />
                        <span className="font-medium" style={{ color: 'var(--ide-text)' }}>
                          {exportingWorkspace ? 'Exporting Archive...' : 'Export All Workspaces...'}
                        </span>
                      </div>
                      <span className="text-[10px] opacity-50">.zip</span>
                    </button>
                  </div>
                </div>

                {/* Keyboard Shortcuts Reference */}
                <div 
                  className="p-3.5 rounded-lg border space-y-2.5"
                  style={{
                    backgroundColor: 'var(--ide-card-bg)',
                    borderColor: 'var(--ide-border)',
                  }}
                >
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] opacity-70">
                    <Keyboard className="w-3.5 h-3.5 text-sky-400" />
                    <span>Keybindings Quick Reference</span>
                  </div>

                  <div className="space-y-1.5 text-[10.5px]">
                    <div className="flex justify-between items-center opacity-80">
                      <span>Quick Open</span>
                      <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ide-border)' }}>Ctrl+P</kbd>
                    </div>
                    <div className="flex justify-between items-center opacity-80">
                      <span>Command Palette</span>
                      <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ide-border)' }}>Ctrl+Shift+P</kbd>
                    </div>
                    <div className="flex justify-between items-center opacity-80">
                      <span>Toggle Sidebar</span>
                      <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ide-border)' }}>Ctrl+B</kbd>
                    </div>
                    <div className="flex justify-between items-center opacity-80">
                      <span>Toggle Terminal</span>
                      <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ide-border)' }}>Ctrl+`</kbd>
                    </div>
                    <div className="flex justify-between items-center opacity-80">
                      <span>Split Editor</span>
                      <kbd className="px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--ide-border)' }}>Ctrl+\</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Recent Workspaces (7 cols) */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Recent Workspaces ({filteredProjects.length})</span>
                  </h3>

                  {/* Filter Pills */}
                  <div 
                    className="flex items-center p-0.5 rounded border text-[10px]"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                    }}
                  >
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2 py-0.5 rounded ${filterType === 'all' ? 'bg-sky-600 text-white font-semibold' : 'opacity-70 hover:opacity-100'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType('owned')}
                      className={`px-2 py-0.5 rounded ${filterType === 'owned' ? 'bg-sky-600 text-white font-semibold' : 'opacity-70 hover:opacity-100'}`}
                    >
                      Owned
                    </button>
                    <button
                      onClick={() => setFilterType('shared')}
                      className={`px-2 py-0.5 rounded ${filterType === 'shared' ? 'bg-sky-600 text-white font-semibold' : 'opacity-70 hover:opacity-100'}`}
                    >
                      Shared
                    </button>
                  </div>
                </div>

                {/* Workspace Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 opacity-50 absolute left-2.5 top-2.5" />
                  <input
                    id="workspace-search-input"
                    type="text"
                    placeholder="Search recent workspaces... (/)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border rounded focus:outline-none transition-colors"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  />
                </div>

                {/* Workspaces List Skeleton */}
                {loading || authLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div 
                        key={i} 
                        className="p-3 rounded-lg border flex items-center justify-between animate-pulse" 
                        style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-white/10" />
                          <div className="space-y-1.5">
                            <div className="w-32 h-3.5 rounded bg-white/10" />
                            <div className="w-48 h-2.5 rounded bg-white/5" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-4 rounded bg-white/10" />
                          <div className="w-12 h-4 rounded bg-white/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div 
                    className="p-8 rounded-lg border text-center space-y-2 opacity-70"
                    style={{
                      backgroundColor: 'var(--ide-card-bg)',
                      borderColor: 'var(--ide-border)',
                    }}
                  >
                    <FileCode className="w-8 h-8 opacity-40 mx-auto" />
                    <p className="text-xs">
                      {searchQuery ? `No workspaces matching "${searchQuery}"` : 'No workspaces available yet.'}
                    </p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Create your first workspace
                    </button>
                  </div>
                ) : (
                  <div 
                    className="rounded-lg border divide-y overflow-hidden shadow-sm"
                    style={{
                      backgroundColor: 'var(--ide-card-bg)',
                      borderColor: 'var(--ide-border)',
                    }}
                  >
                    {filteredProjects.map((project) => {
                      const isOwner = project.owner_id === user?.id;
                      return (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group text-xs"
                        >
                          <Link href={`/project/${project.id}`} className="min-w-0 flex-1 pr-3">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold truncate group-hover:text-sky-400 transition-colors" style={{ color: 'var(--ide-text)' }}>
                                {project.name}
                              </span>
                              <span 
                                className={`text-[9.5px] px-1.5 py-0.2 rounded font-medium ${
                                  isOwner 
                                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20' 
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {isOwner ? 'Owner' : 'Member'}
                              </span>
                            </div>
                            <p className="text-[11px] opacity-60 truncate">
                              {project.description || 'Collaborative IDE workspace'}
                            </p>
                          </Link>

                          <div className="flex items-center gap-3 opacity-80 group-hover:opacity-100 flex-shrink-0">
                            <span className="text-[10px] opacity-60 hidden sm:inline">
                              {new Date(project.updated_at).toLocaleDateString()}
                            </span>

                            {isOwner && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setProjectToDelete(project);
                                }}
                                className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Workspace"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <Link
                              href={`/project/${project.id}/public`}
                              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Public Showcase Page"
                            >
                              <Globe className="w-3.5 h-3.5" />
                            </Link>

                            <Link
                              href={`/project/${project.id}`}
                              className="px-2.5 py-1 rounded bg-sky-600/10 text-sky-400 hover:bg-sky-600 hover:text-white border border-sky-500/20 font-medium text-[11px] transition-all flex items-center gap-1"
                            >
                              <span>Open</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div 
            className="w-full max-w-sm rounded-lg border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--ide-card-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
          >
            <h4 className="text-sm font-bold text-white">Delete Workspace?</h4>
            <p className="text-xs opacity-80 leading-relaxed">
              Are you sure you want to permanently delete <strong>{projectToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded border text-xs opacity-80 hover:opacity-100"
                style={{ borderColor: 'var(--ide-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProjectConfirm}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newP) => {
          setProjects([newP, ...projects]);
          window.location.href = `/project/${newP.id}`;
        }}
      />

      {user && (
        <>
          <ImportProjectModal
            isOpen={isImportProjectOpen}
            onClose={() => setIsImportProjectOpen(false)}
            user={user}
            onProjectImported={(newP) => {
              setProjects([newP, ...projects]);
              window.location.href = `/project/${newP.id}`;
            }}
          />

          <ImportWorkspaceModal
            isOpen={isImportWorkspaceOpen}
            onClose={() => setIsImportWorkspaceOpen(false)}
            user={user}
            onSuccess={fetchProjects}
          />
        </>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode="signin"
      />

      {/* Direct Level 9 Modals for Dashboard */}
      {user && (
        <>
          <NotificationCenterPanel
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            notifications={notifications}
            onMarkAllRead={() => {
              DataService.markAllNotificationsRead(user.id);
              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }}
            onAcceptPartnerRequest={async (reqId) => {
              await DataService.respondToPartnerRequest(reqId, true);
              soundManager.playSuccess();
              setNotifications(prev => prev.filter(n => n.partnerRequestId !== reqId));
            }}
            onIgnorePartnerRequest={async (reqId) => {
              await DataService.respondToPartnerRequest(reqId, false);
              setNotifications(prev => prev.filter(n => n.partnerRequestId !== reqId));
            }}
            onOpenProject={(pid) => {
              setIsNotificationsOpen(false);
              window.location.href = `/project/${pid}`;
            }}
            onDismissNotification={(id) => {
              setNotifications(prev => prev.filter(n => n.id !== id));
            }}
          />

          <UserProfileModal
            isOpen={isProfileModalOpen}
            initialTab={profileModalTab}
            onClose={() => setIsProfileModalOpen(false)}
            currentUser={user}
            settings={editorSettings}
            onUpdateSettings={handleUpdateSettings}
            onProfileUpdated={() => {
              soundManager.playSuccess();
            }}
          />

          <EditorSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={editorSettings}
            onUpdateSettings={handleUpdateSettings}
          />

          <DeveloperDiscoveryModal
            isOpen={isCollaboratorsOpen}
            onClose={() => setIsCollaboratorsOpen(false)}
          />
        </>
      )}
    </div>
  );
}
