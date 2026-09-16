'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { Project } from '@/lib/types';
import { THEMES, ThemeId, applyThemeVariables } from '@/lib/themes';
import { UserMenu } from '@/components/auth/UserMenu';
import { AuthModal } from '@/components/auth/AuthModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { ImportProjectModal } from '@/components/dashboard/ImportProjectModal';
import { ImportWorkspaceModal } from '@/components/dashboard/ImportWorkspaceModal';
import { 
  Code2, 
  FolderGit2, 
  Plus, 
  Clock, 
  ArrowRight,
  FileCode, 
  LogIn, 
  Upload, 
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
  Sparkles
} from 'lucide-react';
import { NotificationCenterPanel } from '@/components/workspace/NotificationCenterPanel';
import { UserProfileModal } from '@/components/workspace/UserProfileModal';
import { EditorSettingsModal, EditorSettings } from '@/components/workspace/EditorSettingsModal';
import { DeveloperDiscoveryModal } from '@/components/profile/DeveloperDiscoveryModal';
import { soundManager } from '@/lib/sound';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportProjectOpen, setIsImportProjectOpen] = useState(false);
  const [isImportWorkspaceOpen, setIsImportWorkspaceOpen] = useState(false);
  const [exportingWorkspace, setExportingWorkspace] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'owned' | 'shared'>('all');

  // Last opened workspace state for instant resume
  const [lastProject, setLastProject] = useState<{ id: string; name: string } | null>(null);

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('dark');

  // Deletion State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Initialize Theme from user preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('codecollab_editor_settings');
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
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('codecollab_editor_settings');
        const settings = savedSettings ? JSON.parse(savedSettings) : {};
        settings.theme = newTheme;
        localStorage.setItem('codecollab_editor_settings', JSON.stringify(settings));
      } catch (e) {}
    }
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
          type: n.type,
          title: n.title,
          message: n.message,
          read: n.read,
          createdAt: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          projectId: n.data?.project_id,
          partnerRequestId: n.data?.partner_request_id,
        })));
      } catch (e) {}

      if (typeof window !== 'undefined') {
        const lastId = localStorage.getItem('codecollab_last_project_id');
        const lastName = localStorage.getItem('codecollab_last_project_name');
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Sort by recent updated by default
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [projects, filterType, searchQuery, user?.id]);

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
        className="h-10 border-b px-4 flex items-center justify-between sticky top-0 z-40 flex-shrink-0"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-sky-600 flex items-center justify-center text-white font-bold">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold tracking-wider text-[12px]" style={{ color: 'var(--ide-text)' }}>
            CodeCollab
          </span>
          <span className="opacity-40 text-[11px]">/</span>
          <span className="opacity-70 text-[11px]">Welcome</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct Navigation for Signed In Users */}
          {user && (
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-white/10 flex items-center gap-1.5 opacity-80 hover:opacity-100"
                title="Profile & Skills"
              >
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Profile</span>
              </button>

              <button
                onClick={() => setIsCollaboratorsOpen(true)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-white/10 flex items-center gap-1.5 opacity-80 hover:opacity-100"
                title="Collaborators & Developers"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Collaborators</span>
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-white/10 flex items-center gap-1.5 opacity-80 hover:opacity-100"
                title="IDE Settings"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Settings</span>
              </button>

              <button
                onClick={() => setIsNotificationsOpen(true)}
                className="p-1.5 rounded-md text-[11px] font-medium transition-colors hover:bg-white/10 relative opacity-80 hover:opacity-100 text-amber-400"
                title="Notification Center"
              >
                <Bell className="w-3.5 h-3.5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[var(--ide-dock-header)]" />
                )}
              </button>
            </div>
          )}

          {/* Theme Quick-Picker */}
          <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
            <Palette className="w-3.5 h-3.5" style={{ color: 'var(--ide-accent)' }} />
            <select
              value={currentTheme}
              onChange={(e) => handleThemeChange(e.target.value as ThemeId)}
              className="bg-transparent border rounded px-1.5 py-0.5 text-[11px] focus:outline-none cursor-pointer"
              style={{
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
                backgroundColor: 'var(--ide-input-bg)',
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
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
            onOpenSettingsModal={() => setIsSettingsOpen(true)}
            onOpenDiscoveryModal={() => setIsCollaboratorsOpen(true)}
          />
        </div>
      </header>

      {/* Main IDE Welcome Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10 flex flex-col justify-start">
        {!user && !authLoading ? (
          <div 
            className="p-8 rounded-lg border my-auto text-center max-w-md mx-auto space-y-4"
            style={{
              backgroundColor: 'var(--ide-card-bg)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <div className="w-10 h-10 rounded-lg bg-sky-600/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">CodeCollab IDE</h2>
              <p className="text-[11px] mt-1 opacity-70 leading-relaxed">
                Cloud-based collaborative web IDE with real-time editing, terminal execution, Git sync, and multi-user presence.
              </p>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-2 px-4 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Continue</span>
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

                {/* Workspaces List */}
                {loading || authLoading ? (
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-12 rounded border animate-pulse" style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }} />
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
            onClose={() => setIsProfileModalOpen(false)}
            currentUser={user}
            settings={{
              theme: currentTheme,
              fontSize: 14,
              tabSize: 2,
              wordWrap: 'off',
              minimap: true,
            }}
            onUpdateSettings={(newS) => {
              if (newS.theme) handleThemeChange(newS.theme as ThemeId);
            }}
            onProfileUpdated={() => {
              soundManager.playSuccess();
            }}
          />

          <EditorSettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={{
              theme: currentTheme,
              fontSize: 14,
              tabSize: 2,
              wordWrap: 'off',
              minimap: true,
            }}
            onUpdateSettings={(newS) => {
              if (newS.theme) handleThemeChange(newS.theme as ThemeId);
            }}
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
