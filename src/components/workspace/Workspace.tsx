'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Project, FileItem, ProjectMember, getUserColor, isMediaFile, UserProfile } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { config } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { applyThemeVariables, ThemeId, THEMES } from '@/lib/themes';

// Workspace Components
import { ActivityBar, ActivityView } from './ActivityBar';
import { FileTree } from './FileTree';
import { OpenTabs } from './OpenTabs';
import { Breadcrumbs } from './Breadcrumbs';
import { MonacoEditorWrapper } from './MonacoEditorWrapper';
import { MediaViewer } from './MediaViewer';
import { ProjectPresence } from './ProjectPresence';
import { CollaboratorsPanel } from './CollaboratorsPanel';
import { GitPanel } from './GitPanel';
import { BottomDock, DockOrientation, DockTab } from './BottomDock';
import { ProblemItem } from './ProblemsPanel';
import { OutputLogEntry } from './OutputPanel';

// Modals
import { InviteMemberModal } from './InviteMemberModal';
import { UserMenu } from '@/components/auth/UserMenu';
import { CommandPalette, CommandItem } from './CommandPalette';
import { QuickOpenModal } from './QuickOpenModal';
import { GlobalSearchModal } from './GlobalSearchModal';
import { EditorSettingsModal, EditorSettings } from './EditorSettingsModal';
import { GitHubModal } from './GitHubModal';
import { UserProfileModal } from './UserProfileModal';
import { PublicProfileModal } from './PublicProfileModal';
import { DeveloperDiscoveryModal } from '@/components/profile/DeveloperDiscoveryModal';
import { ProjectSwitcherModal } from './ProjectSwitcherModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { NotificationsPopover, AppNotification } from './NotificationsPopover';

import { 
  ChevronLeft, 
  UserPlus, 
  Settings, 
  Search, 
  FolderPlus, 
  FilePlus, 
  Loader2, 
  ShieldAlert, 
  Command,
  FileSearch,
  Terminal,
  MonitorPlay,
  MessageSquare,
  Mic,
  Activity,
  Download,
  FolderGit2,
  Github,
  GitBranch,
  AlertCircle,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  SplitSquareVertical,
  SplitSquareHorizontal,
  FolderOpen,
  FileCode,
  X,
  Bell,
  CheckCircle2,
  ExternalLink,
  Users,
  User
} from 'lucide-react';

interface WorkspaceProps {
  projectId: string;
}

export interface EditorGroupState {
  id: string;
  openFiles: FileItem[];
  activeFileId: string | null;
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'off',
  minimap: true,
};

export function Workspace({ projectId }: WorkspaceProps) {
  const { user, loading: authLoading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [role, setRole] = useState<'owner' | 'member' | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // Level 7: Multi-Editor Groups & Split State
  const [editorGroups, setEditorGroups] = useState<EditorGroupState[]>([
    { id: 'group-1', openFiles: [], activeFileId: null }
  ]);
  const [activeGroupId, setActiveGroupId] = useState<string>('group-1');
  const [splitLayout, setSplitLayout] = useState<'single' | 'vertical' | 'horizontal'>('single');
  const [targetJumpLocation, setTargetJumpLocation] = useState<{ line: number; col?: number } | null>(null);

  // Level 7: Activity Bar & Sidebar Views
  const [activeActivityView, setActiveActivityView] = useState<ActivityView | null>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Level 7: Diagnostics & Output Panels
  const [problems, setProblems] = useState<ProblemItem[]>([]);
  const [outputLogs, setOutputLogs] = useState<OutputLogEntry[]>([
    {
      id: 'init-log-1',
      channel: 'system',
      message: 'CodeCollab Cloud IDE Environment initialized.',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'init-log-2',
      channel: 'sync',
      message: 'Connecting to real-time CRDT document and filesystem stream...',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  // Level 4: Communication & Collaboration States
  const [unreadCount, setUnreadCount] = useState(0);
  const userColor = getUserColor(user?.id || 'guest');

  // Peer presence active file tracking: fileId -> peer list
  const [collaboratorsByFile, setCollaboratorsByFile] = useState<Record<string, { id: string; name: string; color: string }[]>>({});
  const [onlinePeersList, setOnlinePeersList] = useState<{ id: string; name: string; color: string; currentFileId?: string; currentFileName?: string }[]>([]);

  // Contextual Chat Toast Notification
  const [chatToast, setChatToast] = useState<{
    id: string;
    senderName: string;
    message: string;
    filePath?: string;
    line?: number;
  } | null>(null);

  // Activity Broadcast helper
  const logAndBroadcastActivity = useCallback(async (actionType: any, details: string, targetObject?: string) => {
    try {
      const act = await DataService.logActivity(
        projectId,
        user?.id || 'guest',
        user?.full_name || 'Anonymous Peer',
        actionType,
        details,
        targetObject
      );
      // Broadcast via comm room using centralized config URL
      const wsUrl = config.buildWsUrl('/comm', { projectId });
      const tempWs = new WebSocket(wsUrl);
      tempWs.onopen = () => {
        tempWs.send(JSON.stringify({ type: 'activity_event', activity: act }));
        setTimeout(() => tempWs.close(), 300);
      };
    } catch (e) {}
  }, [projectId, user?.id, user?.full_name]);

  // Append to Output Logs
  const appendOutputLog = useCallback((channel: 'system' | 'sync' | 'git' | 'runtime', message: string) => {
    setOutputLogs((prev) => [
      ...prev.slice(-150),
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        channel,
        message,
        timestamp: new Date().toLocaleTimeString(),
      }
    ]);
  }, []);

  // WebRTC Voice hook
  const {
    isInVoice,
    isMuted,
    voicePeers,
    connectionState: voiceConnectionState,
    joinVoice,
    leaveVoice,
    toggleMute,
  } = useVoiceChat({
    projectId,
    userId: user?.id || 'guest',
    userName: user?.full_name || 'Anonymous Peer',
    userColor,
    onActivityEvent: (details) => {
      logAndBroadcastActivity(
        details.includes('joined') ? 'voice_joined' : 'voice_left',
        details
      );
    },
  });

  // Terminal, Preview, Chat & Voice Bottom Dock
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [activeDockTab, setActiveDockTab] = useState<DockTab>('terminal');
  const [dockOrientation, setDockOrientation] = useState<DockOrientation>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('codecollab_dock_orientation');
      if (saved === 'bottom' || saved === 'right' || saved === 'left' || saved === 'fullscreen') {
        return saved;
      }
    }
    return 'bottom';
  });

  const handleOrientationChange = (newOrientation: DockOrientation) => {
    setDockOrientation(newOrientation);
    if (typeof window !== 'undefined') {
      localStorage.setItem('codecollab_dock_orientation', newOrientation);
    }
  };

  // Modals & IDE Tools
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedPublicUserId, setSelectedPublicUserId] = useState<string | null>(null);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isProjectSwitcherOpen, setIsProjectSwitcherOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentGitBranch, setCurrentGitBranch] = useState('main');

  // User-specific custom resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`codecollab_sidebar_width_${user?.id || 'guest'}`);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 200 && val <= 900) return val;
      }
    }
    return 300;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const saved = localStorage.getItem(`codecollab_sidebar_width_${user.id}`);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 200 && val <= 900) {
          setSidebarWidth(val);
        }
      }
    }
  }, [user?.id]);

  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const maxWidth = typeof window !== 'undefined' ? Math.min(850, window.innerWidth - 300) : 800;
      const newWidth = Math.max(220, Math.min(maxWidth, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      const delta = ev.clientX - startX;
      const maxWidth = typeof window !== 'undefined' ? Math.min(850, window.innerWidth - 300) : 800;
      const finalWidth = Math.max(220, Math.min(maxWidth, startWidth + delta));
      setSidebarWidth(finalWidth);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`codecollab_sidebar_width_${user?.id || 'guest'}`, String(finalWidth));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const [settings, setSettings] = useState<EditorSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('codecollab_editor_settings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Apply Theme Variables
  useEffect(() => {
    applyThemeVariables(settings.theme as ThemeId);
  }, [settings.theme]);

  const updateSettings = (newSettings: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        localStorage.setItem('codecollab_editor_settings', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Sync file content to remote workspace filesystem (uses config API URL)
  const syncFileToWorkspace = (filePath: string, content: string) => {
    try {
      fetch(config.buildApiUrl('/api/sync-file'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, path: filePath, content }),
      }).catch(() => {});
    } catch (e) {}
  };

  // Load project, verify permission, and load files
  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Verify access
      const access = await DataService.verifyProjectAccess(projectId, user.id);
      if (!access.authorized) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      setRole(access.role || 'member');

      // 2. Fetch data in parallel
      const [projData, filesData, membersData, notifsData] = await Promise.all([
        DataService.getProject(projectId),
        DataService.getFiles(projectId),
        DataService.getMembers(projectId),
        DataService.getNotifications(user.id),
      ]);

      setProject(projData);
      if (typeof window !== 'undefined' && projData) {
        localStorage.setItem('codecollab_last_project_id', projData.id);
        localStorage.setItem('codecollab_last_project_name', projData.name);
      }
      setFiles(filesData);
      setMembers(membersData);
      setNotifications(notifsData.map(n => ({
        id: n.id,
        type: n.type as any,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        projectId: n.data?.project_id,
        partnerRequestId: n.data?.partner_request_id,
      })));

      // Seed remote workspace disk with existing files
      try {
        fetch(config.buildApiUrl('/api/sync-project'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, files: filesData }),
        }).catch(() => {});
      } catch (e) {}

      // Workspace State Restoration (Level 7)
      const storageKey = `codecollab_workspace_${projectId}`;
      let restored = false;
      if (typeof window !== 'undefined') {
        const savedRaw = localStorage.getItem(storageKey);
        if (savedRaw) {
          try {
            const savedState = JSON.parse(savedRaw);
            if (savedState.splitLayout) setSplitLayout(savedState.splitLayout);
            if (savedState.activeActivityView) setActiveActivityView(savedState.activeActivityView);
            if (savedState.isSidebarOpen !== undefined) setIsSidebarOpen(savedState.isSidebarOpen);
            if (savedState.isDockOpen !== undefined) setIsDockOpen(savedState.isDockOpen);
            if (savedState.activeDockTab) setActiveDockTab(savedState.activeDockTab);

            if (savedState.editorGroups && Array.isArray(savedState.editorGroups)) {
              const reconstructed: EditorGroupState[] = savedState.editorGroups.map((g: any) => {
                const groupFiles = filesData.filter(f => g.openFileIds?.includes(f.id));
                return {
                  id: g.id,
                  openFiles: groupFiles,
                  activeFileId: groupFiles.some(f => f.id === g.activeFileId) ? g.activeFileId : (groupFiles[0]?.id || null)
                };
              });

              if (reconstructed.length > 0) {
                setEditorGroups(reconstructed);
                setActiveGroupId(savedState.activeGroupId || reconstructed[0].id);
                restored = true;
              }
            }
          } catch (e) {}
        }
      }

      // Default to opening first code file if not restored
      if (!restored) {
        const firstCodeFile = filesData.find((f) => !f.is_folder);
        if (firstCodeFile) {
          setEditorGroups([
            { id: 'group-1', openFiles: [firstCodeFile], activeFileId: firstCodeFile.id }
          ]);
        }
      }

      appendOutputLog('system', `Loaded workspace "${projData?.name || projectId}" with ${filesData.length} files.`);

      // Record workspace entry in project activity timeline
      const sessionKey = `workspace_entered_${projectId}_${user.id}`;
      if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');
        logAndBroadcastActivity(
          'member_joined',
          `${user.full_name || 'A user'} entered the workspace`,
          projectId
        );
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, user, logAndBroadcastActivity, appendOutputLog]);

  useEffect(() => {
    if (user && !authLoading) {
      loadWorkspaceData();
    }
  }, [user, authLoading, loadWorkspaceData]);

  // Persist Workspace State (Debounced)
  useEffect(() => {
    if (!project || loading) return;
    const storageKey = `codecollab_workspace_${projectId}`;
    const timeout = setTimeout(() => {
      try {
        const stateToSave = {
          splitLayout,
          activeGroupId,
          isSidebarOpen,
          activeActivityView,
          isDockOpen,
          activeDockTab,
          dockOrientation,
          editorGroups: editorGroups.map(g => ({
            id: g.id,
            openFileIds: g.openFiles.map(f => f.id),
            activeFileId: g.activeFileId,
          })),
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
      } catch (e) {}
    }, 400);

    return () => clearTimeout(timeout);
  }, [project, loading, projectId, splitLayout, activeGroupId, isSidebarOpen, activeActivityView, isDockOpen, activeDockTab, dockOrientation, editorGroups]);

  // Real-Time File-Tree Synchronization across peers via Yjs workspace room
  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = config.wsUrl;
    const roomName = `project-${projectId}-filetree-sync`;
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);

    const ymap = ydoc.getMap('file-events');

    ymap.observe(() => {
      DataService.getFiles(projectId).then((updatedFiles) => {
        setFiles(updatedFiles);
        setEditorGroups((prevGroups) =>
          prevGroups.map((group) => {
            const freshOpen = group.openFiles
              .filter((tab) => updatedFiles.some((f) => f.id === tab.id))
              .map((tab) => updatedFiles.find((f) => f.id === tab.id) || tab);
            const freshActive = freshOpen.some((f) => f.id === group.activeFileId)
              ? group.activeFileId
              : (freshOpen[freshOpen.length - 1]?.id || null);
            return {
              ...group,
              openFiles: freshOpen,
              activeFileId: freshActive,
            };
          })
        );
      });
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [projectId]);

  // Broadcast file tree event to peers
  const broadcastFileChange = () => {
    const ydoc = new Y.Doc();
    const wsUrl = config.wsUrl;
    const roomName = `project-${projectId}-filetree-sync`;
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    const ymap = ydoc.getMap('file-events');
    ymap.set('lastUpdate', Date.now());
    setTimeout(() => {
      provider.destroy();
      ydoc.destroy();
    }, 500);
  };

  // Editor Group management
  const getActiveGroup = (): EditorGroupState => {
    return editorGroups.find(g => g.id === activeGroupId) || editorGroups[0];
  };

  const handleSelectFile = (file: FileItem, targetGroupId?: string) => {
    if (file.is_folder) return;
    const destGroupId = targetGroupId || activeGroupId;

    setEditorGroups((prev) =>
      prev.map((group) => {
        if (group.id !== destGroupId) return group;
        const exists = group.openFiles.some((f) => f.id === file.id);
        const updatedOpen = exists ? group.openFiles : [...group.openFiles, file];
        return {
          ...group,
          openFiles: updatedOpen,
          activeFileId: file.id,
        };
      })
    );
    setActiveGroupId(destGroupId);
  };

  const handleCloseTabInGroup = useCallback((groupId: string, fileId: string) => {
    setEditorGroups((prev) => {
      const updated = prev.map((group) => {
        if (group.id !== groupId) return group;
        const remaining = group.openFiles.filter((f) => f.id !== fileId);
        let nextActive = group.activeFileId;
        if (group.activeFileId === fileId) {
          nextActive = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
        }
        return {
          ...group,
          openFiles: remaining,
          activeFileId: nextActive,
        };
      });

      // If group-2 is empty, auto-close split
      if (splitLayout !== 'single') {
        const g2 = updated.find(g => g.id === 'group-2');
        if (g2 && g2.openFiles.length === 0) {
          setSplitLayout('single');
          setActiveGroupId('group-1');
          return updated.filter(g => g.id !== 'group-2');
        }
      }

      return updated;
    });
  }, [splitLayout]);

  // Dedicated handler to close active tab in currently active editor group
  const handleCloseActiveTab = useCallback(() => {
    setEditorGroups((prev) => {
      const currentGroup = prev.find(g => g.id === activeGroupId) || prev[0];
      if (!currentGroup || !currentGroup.activeFileId) return prev;
      const fileId = currentGroup.activeFileId;
      const remaining = currentGroup.openFiles.filter((f) => f.id !== fileId);
      let nextActive = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      
      const updated = prev.map((group) => {
        if (group.id !== currentGroup.id) return group;
        return {
          ...group,
          openFiles: remaining,
          activeFileId: nextActive,
        };
      });

      if (splitLayout !== 'single') {
        const g2 = updated.find(g => g.id === 'group-2');
        if (g2 && g2.openFiles.length === 0) {
          setSplitLayout('single');
          setActiveGroupId('group-1');
          return updated.filter(g => g.id !== 'group-2');
        }
      }

      return updated;
    });
  }, [activeGroupId, splitLayout]);

  const handleCycleTab = useCallback((direction: 'next' | 'prev') => {
    setEditorGroups((prev) =>
      prev.map((group) => {
        if (group.id !== activeGroupId || group.openFiles.length <= 1) return group;
        const currentIndex = group.openFiles.findIndex((f) => f.id === group.activeFileId);
        if (currentIndex === -1) return group;
        const nextIndex = direction === 'next'
          ? (currentIndex + 1) % group.openFiles.length
          : (currentIndex - 1 + group.openFiles.length) % group.openFiles.length;
        return {
          ...group,
          activeFileId: group.openFiles[nextIndex].id,
        };
      })
    );
  }, [activeGroupId]);

  const handleCloseOthersInGroup = (groupId: string, fileId: string) => {
    setEditorGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          openFiles: group.openFiles.filter((f) => f.id === fileId),
          activeFileId: fileId,
        };
      })
    );
  };

  const handleCloseToRightInGroup = (groupId: string, fileId: string) => {
    setEditorGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group;
        const idx = group.openFiles.findIndex((f) => f.id === fileId);
        if (idx === -1) return group;
        const remaining = group.openFiles.slice(0, idx + 1);
        return {
          ...group,
          openFiles: remaining,
          activeFileId: remaining.some(f => f.id === group.activeFileId) ? group.activeFileId : fileId,
        };
      })
    );
  };

  const handleCloseAllInGroup = (groupId: string) => {
    setEditorGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          openFiles: [],
          activeFileId: null,
        };
      })
    );
  };

  const handleSplitRight = useCallback(() => {
    if (splitLayout !== 'single') return;
    const currentGroup = getActiveGroup();
    const activeFile = currentGroup.openFiles.find(f => f.id === currentGroup.activeFileId);

    const newGroup: EditorGroupState = {
      id: 'group-2',
      openFiles: activeFile ? [activeFile] : [],
      activeFileId: activeFile ? activeFile.id : null,
    };

    setSplitLayout('vertical');
    setEditorGroups([currentGroup, newGroup]);
    setActiveGroupId('group-2');
    appendOutputLog('system', 'Editor split vertically.');
  }, [splitLayout, editorGroups, activeGroupId, appendOutputLog]);

  const handleSplitDown = useCallback(() => {
    if (splitLayout !== 'single') return;
    const currentGroup = getActiveGroup();
    const activeFile = currentGroup.openFiles.find(f => f.id === currentGroup.activeFileId);

    const newGroup: EditorGroupState = {
      id: 'group-2',
      openFiles: activeFile ? [activeFile] : [],
      activeFileId: activeFile ? activeFile.id : null,
    };

    setSplitLayout('horizontal');
    setEditorGroups([currentGroup, newGroup]);
    setActiveGroupId('group-2');
    appendOutputLog('system', 'Editor split horizontally.');
  }, [splitLayout, editorGroups, activeGroupId, appendOutputLog]);

  const handleCloseGroup = (groupId: string) => {
    setSplitLayout('single');
    setEditorGroups((prev) => prev.filter(g => g.id !== groupId));
    setActiveGroupId('group-1');
  };

  const handleOpenToSide = useCallback((file: FileItem) => {
    if (splitLayout === 'single') {
      const currentGroup = getActiveGroup();
      const newGroup: EditorGroupState = {
        id: 'group-2',
        openFiles: [file],
        activeFileId: file.id,
      };
      setSplitLayout('vertical');
      setEditorGroups([currentGroup, newGroup]);
      setActiveGroupId('group-2');
      appendOutputLog('system', `Opened ${file.name} to side.`);
    } else {
      handleSelectFile(file, 'group-2');
    }
  }, [splitLayout, getActiveGroup, appendOutputLog, handleSelectFile]);

  // Request Chromium Keyboard Lock API to prevent browser from hijacking IDE shortcuts (like Ctrl+W, Ctrl+N, Ctrl+P)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'keyboard' in navigator && 'lock' in (navigator as any).keyboard) {
      try {
        (navigator as any).keyboard.lock([
          'KeyW',
          'KeyP',
          'KeyS',
          'KeyB',
          'KeyJ',
          'KeyT',
          'KeyN',
        ]).catch(() => {
          // Non-fatal if browser rejects without full-screen or user gesture
        });
      } catch (e) {}
    }
    return () => {
      if (typeof window !== 'undefined' && 'keyboard' in navigator && 'unlock' in (navigator as any).keyboard) {
        try {
          (navigator as any).keyboard.unlock();
        } catch (e) {}
      }
    };
  }, []);

  // Global Capture-Phase Keyboard listener: catches Ctrl+W, Ctrl+S, Ctrl+P etc. BEFORE browser tab closes or print dialog triggers
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Close Active Editor Tab: Ctrl+W / Cmd+W (CRITICAL: intercept so browser tab doesn't close)
      if (cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'w' || e.key === 'W' || e.code === 'KeyW')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleCloseActiveTab();
        return;
      }

      // 2. Command Palette: Ctrl+Shift+P / Cmd+Shift+P
      if (cmdOrCtrl && e.shiftKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 3. Quick Open File: Ctrl+P / Cmd+P
      if (cmdOrCtrl && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setIsQuickOpen((prev) => !prev);
        return;
      }

      // 4. Save: Ctrl+S / Cmd+S (Prevent browser 'Save webpage as HTML' dialog)
      if (cmdOrCtrl && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        return;
      }

      // 5. Global Search: Ctrl+Shift+F / Cmd+Shift+F
      if (cmdOrCtrl && e.shiftKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setIsGlobalSearchOpen((prev) => !prev);
        return;
      }

      // 6. Toggle Sidebar: Ctrl+B / Cmd+B
      if (cmdOrCtrl && !e.shiftKey && !e.altKey && (e.key === 'b' || e.key === 'B' || e.code === 'KeyB')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // 7. Toggle Terminal / Dock: Ctrl+` or Ctrl+J / Cmd+` or Cmd+J
      if (cmdOrCtrl && !e.shiftKey && !e.altKey && (e.key === '`' || e.key === '~' || e.code === 'Backquote' || e.key === 'j' || e.key === 'J' || e.code === 'KeyJ')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setIsDockOpen((prev) => !prev);
        return;
      }

      // 8. Split Editor: Ctrl+\ / Cmd+\
      if (cmdOrCtrl && !e.shiftKey && !e.altKey && (e.key === '\\' || e.code === 'Backslash')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleSplitRight();
        return;
      }

      // 9. Cycle Tabs: Ctrl+Tab / Ctrl+Shift+Tab
      if (e.ctrlKey && !e.altKey && (e.key === 'Tab' || e.code === 'Tab')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleCycleTab(e.shiftKey ? 'prev' : 'next');
        return;
      }

      // 10. Project Switcher: Ctrl+Alt+O / Cmd+Alt+O
      if (cmdOrCtrl && e.altKey && (e.key === 'o' || e.key === 'O' || e.code === 'KeyO')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        setIsProjectSwitcherOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [handleCloseActiveTab, handleSplitRight, handleCycleTab]);

  // Navigate to problem or line from Problems panel or Chat
  const handleNavigateToLocation = (fileIdOrPath: string, line?: number, col?: number) => {
    let target = files.find(f => f.id === fileIdOrPath || f.name === fileIdOrPath);
    if (!target) {
      target = files.find(f => f.name.endsWith(fileIdOrPath) || fileIdOrPath.endsWith(f.name));
    }
    if (target) {
      handleSelectFile(target);
      if (line) {
        setTargetJumpLocation({ line, col: col || 1 });
      }
    }
  };

  // File tree handlers
  const handleCreateFile = async (parentId: string | null, name: string, isFolder: boolean) => {
    try {
      const newFile = await DataService.createFile(projectId, parentId, name, isFolder);
      setFiles((prev) => [...prev, newFile]);
      if (!isFolder) {
        handleSelectFile(newFile);
        syncFileToWorkspace(name, newFile.content || '');
      }
      broadcastFileChange();
      logAndBroadcastActivity(
        isFolder ? 'folder_created' : 'file_created',
        `Created ${isFolder ? 'folder' : 'file'} "${name}"`,
        name
      );
      appendOutputLog('sync', `Created ${isFolder ? 'folder' : 'file'} "${name}"`);
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    try {
      await DataService.renameFile(fileId, newName);
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f))
      );
      setEditorGroups((prev) =>
        prev.map((group) => ({
          ...group,
          openFiles: group.openFiles.map((f) => (f.id === fileId ? { ...f, name: newName } : f)),
        }))
      );
      broadcastFileChange();
      logAndBroadcastActivity('file_renamed', `Renamed to "${newName}"`, newName);
      appendOutputLog('sync', `Renamed file to "${newName}"`);
    } catch (err) {
      console.error('Failed to rename file:', err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const fileToDelete = files.find((f) => f.id === fileId);
      await DataService.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setEditorGroups((prev) =>
        prev.map((group) => ({
          ...group,
          openFiles: group.openFiles.filter((f) => f.id !== fileId),
          activeFileId: group.activeFileId === fileId ? null : group.activeFileId,
        }))
      );
      broadcastFileChange();
      if (fileToDelete) {
        logAndBroadcastActivity('file_deleted', `Deleted "${fileToDelete.name}"`, fileToDelete.name);
        appendOutputLog('sync', `Deleted "${fileToDelete.name}"`);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const handleUploadFiles = async (parentId: string | null, uploadedFiles: FileList) => {
    try {
      const fileArray = Array.from(uploadedFiles);
      for (const f of fileArray) {
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });

        const newFile = await DataService.createFile(
          projectId,
          parentId,
          f.name,
          false,
          base64DataUrl
        );

        setFiles((prev) => [...prev.filter((item) => item.id !== newFile.id), newFile]);
        handleSelectFile(newFile);
        syncFileToWorkspace(newFile.name, base64DataUrl);

        logAndBroadcastActivity(
          'media_uploaded',
          `Uploaded file "${f.name}" (${(f.size / 1024).toFixed(1)} KB)`,
          f.name
        );
      }
      broadcastFileChange();
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleUploadFolder = async (parentId: string | null, uploadedFiles: FileList) => {
    try {
      const fileArray = Array.from(uploadedFiles);
      const createdFolders = new Map<string, string>();

      const ensureFolder = async (folderPath: string): Promise<string | null> => {
        const normalized = folderPath.replace(/\/$/, '').trim();
        if (!normalized) return parentId;
        if (createdFolders.has(normalized)) return createdFolders.get(normalized)!;

        const segments = normalized.split('/');
        let currentPath = '';
        let currentParentId: string | null = parentId;

        for (const seg of segments) {
          currentPath = currentPath ? `${currentPath}/${seg}` : seg;
          if (createdFolders.has(currentPath)) {
            currentParentId = createdFolders.get(currentPath)!;
          } else {
            if (seg === '..' || seg === '.') continue;
            const newFolder = await DataService.createFile(projectId, currentParentId, seg, true);
            createdFolders.set(currentPath, newFolder.id);
            setFiles((prev) => [...prev.filter(x => x.id !== newFolder.id), newFolder]);
            currentParentId = newFolder.id;
          }
        }
        return currentParentId;
      };

      for (const f of fileArray) {
        const relPath = (f as any).webkitRelativePath || f.name;
        if (relPath.includes('node_modules/') || relPath.includes('.git/') || relPath.includes('..')) {
          continue;
        }

        const parts = relPath.split('/');
        const fileName = parts[parts.length - 1];
        const dirPath = parts.length > 1 ? parts.slice(0, parts.length - 1).join('/') : '';

        if (!fileName) continue;

        const targetFolderId = dirPath ? await ensureFolder(dirPath) : parentId;
        const ext = fileName.split('.').pop()?.toLowerCase();
        const isBinary = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(ext || '');

        let content = '';
        if (isBinary) {
          content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(f);
          });
        } else {
          content = await f.text();
        }

        const newFile = await DataService.createFile(projectId, targetFolderId, fileName, false, content);
        setFiles((prev) => [...prev.filter(x => x.id !== newFile.id), newFile]);
        syncFileToWorkspace(newFile.name, content);
      }

      broadcastFileChange();
      logAndBroadcastActivity(
        'media_uploaded',
        `Uploaded folder with ${fileArray.length} files`
      );
    } catch (err) {
      console.error('Folder upload failed:', err);
    }
  };

  const handleExportProject = async () => {
    if (!project) return;
    try {
      await DataService.exportProjectAsZip(project);
    } catch (err) {
      console.error('Project export failed:', err);
      alert('Failed to export project ZIP');
    }
  };

  const handleOpenMediaInEditor = (media: { name: string; url: string; type: 'image' | 'video' | 'audio' | 'file' }) => {
    const existingMediaFile = files.find(f => f.content === media.url || f.name === media.name);
    if (existingMediaFile) {
      handleSelectFile(existingMediaFile);
    } else {
      const virtualMediaFile: FileItem = {
        id: `media-tab-${Date.now()}`,
        project_id: projectId,
        parent_id: null,
        name: media.name,
        is_folder: false,
        content: media.url,
        media_type: media.type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      handleSelectFile(virtualMediaFile);
    }
  };

  // Command palette actions
  const commands: CommandItem[] = [
    {
      id: 'quick-open',
      title: 'Quick Open...',
      subtitle: 'Navigate to any file by name',
      shortcut: 'Ctrl+P',
      category: 'File',
      icon: <FileSearch className="w-4 h-4 text-sky-400" />,
      action: () => setIsQuickOpen(true),
    },
    {
      id: 'global-search',
      title: 'Global Search',
      subtitle: 'Find occurrences across all workspace files',
      shortcut: 'Ctrl+Shift+F',
      category: 'Search',
      icon: <Search className="w-4 h-4 text-emerald-400" />,
      action: () => setIsGlobalSearchOpen(true),
    },
    {
      id: 'new-file',
      title: 'New File',
      subtitle: 'Create a new file in project root',
      category: 'File',
      icon: <FilePlus className="w-4 h-4 text-neutral-400" />,
      action: () => handleCreateFile(null, 'untitled.js', false),
    },
    {
      id: 'split-editor-right',
      title: 'Split Editor Right',
      subtitle: 'View two files side-by-side',
      shortcut: 'Ctrl+\\',
      category: 'View',
      icon: <SplitSquareVertical className="w-4 h-4 text-sky-400" />,
      action: handleSplitRight,
    },
    {
      id: 'split-editor-down',
      title: 'Split Editor Down',
      subtitle: 'View two files top-and-bottom',
      category: 'View',
      icon: <SplitSquareHorizontal className="w-4 h-4 text-sky-400" />,
      action: handleSplitDown,
    },
    {
      id: 'toggle-sidebar',
      title: 'Toggle Sidebar',
      subtitle: 'Show or hide the primary sidebar',
      shortcut: 'Ctrl+B',
      category: 'View',
      icon: <PanelLeftClose className="w-4 h-4 text-neutral-400" />,
      action: () => setIsSidebarOpen(prev => !prev),
    },
    {
      id: 'toggle-terminal',
      title: 'Toggle Integrated Terminal',
      subtitle: 'Open or collapse the bottom dock',
      shortcut: 'Ctrl+`',
      category: 'Terminal',
      icon: <Terminal className="w-4 h-4 text-emerald-400" />,
      action: () => {
        setIsDockOpen((prev) => !prev);
        setActiveDockTab('terminal');
      },
    },
    {
      id: 'toggle-problems',
      title: 'View Problems & Diagnostics',
      subtitle: 'Check syntax errors and warnings',
      category: 'Diagnostics',
      icon: <AlertCircle className="w-4 h-4 text-amber-400" />,
      action: () => {
        setIsDockOpen(true);
        setActiveDockTab('problems');
      },
    },
    {
      id: 'switch-project',
      title: 'Switch Project / Workspace',
      subtitle: 'Quickly switch to another project',
      shortcut: 'Ctrl+Alt+O',
      category: 'Workspace',
      icon: <FolderOpen className="w-4 h-4 text-sky-400" />,
      action: () => setIsProjectSwitcherOpen(true),
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts Reference',
      subtitle: 'View full cheat sheet of IDE shortcuts',
      category: 'Help',
      icon: <Settings className="w-4 h-4 text-neutral-400" />,
      action: () => setIsShortcutsOpen(true),
    },
    {
      id: 'settings',
      title: 'IDE Preferences & Themes',
      subtitle: 'Customize themes, font size, minimap and more',
      shortcut: 'Ctrl+,',
      category: 'Preferences',
      icon: <Settings className="w-4 h-4 text-neutral-400" />,
      action: () => setIsProfileModalOpen(true),
    },
    {
      id: 'discover-developers',
      title: 'Discover Developers & Collaborators',
      subtitle: 'Find developers by skill, tech stack and send partner requests',
      shortcut: 'Ctrl+Shift+D',
      category: 'Community',
      icon: <Users className="w-4 h-4 text-emerald-400" />,
      action: () => setIsDiscoveryOpen(true),
    },
    {
      id: 'open-profile',
      title: 'Open Developer Profile Page',
      subtitle: 'View your public profile, activity and pinned projects',
      shortcut: 'Ctrl+Shift+U',
      category: 'Profile',
      icon: <User className="w-4 h-4 text-indigo-400" />,
      action: () => {
        if (user) {
          window.open(`/profile/${user.username || user.id}`, '_blank');
        }
      },
    },
  ];

  // Activity Bar View change handler
  const handleSelectActivityView = (view: ActivityView) => {
    if (activeActivityView === view) {
      setIsSidebarOpen(!isSidebarOpen);
    } else {
      setActiveActivityView(view);
      setIsSidebarOpen(true);
    }
  };

  if (authLoading || loading) {
    return (
      <div 
        className="h-screen w-screen flex flex-col items-center justify-center gap-4 select-none"
        style={{ backgroundColor: 'var(--ide-bg)', color: 'var(--ide-text)' }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <p className="text-sm font-medium text-neutral-400">Loading CodeCollab IDE Workspace...</p>
      </div>
    );
  }

  if (unauthorized || !project) {
    return (
      <div 
        className="h-screen w-screen flex flex-col items-center justify-center gap-4 text-neutral-300 p-6 select-none"
        style={{ backgroundColor: 'var(--ide-bg)' }}
      >
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-sm text-neutral-400 max-w-md text-center">
          You do not have permission to view or edit this project workspace.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded text-sm font-medium transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const activeGroup = getActiveGroup();
  const activeFile = activeGroup.openFiles.find(f => f.id === activeGroup.activeFileId) || null;

  return (
    <div 
      className="h-screen w-screen flex flex-col overflow-hidden text-neutral-200 select-none"
      style={{
        backgroundColor: 'var(--ide-bg)',
        color: 'var(--ide-text)',
      }}
    >
      {/* 1. Top IDE App Header */}
      <header 
        className="h-9 border-b flex items-center justify-between px-2 text-xs flex-shrink-0 z-30"
        style={{
          backgroundColor: 'var(--ide-activity)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Left branding & Workspace Switcher */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--ide-text-muted)' }}
            title="Return to Dashboard"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <button
            onClick={() => setIsProjectSwitcherOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors group text-left"
            title="Switch Workspace (Ctrl+Alt+O)"
          >
            <span 
              className="font-bold tracking-wide group-hover:text-sky-400 transition-colors"
              style={{ color: 'var(--ide-text)' }}
            >
              CodeCollab
            </span>
            <span className="opacity-50">/</span>
            <span 
              className="font-medium truncate max-w-[140px] group-hover:underline opacity-80"
              style={{ color: 'var(--ide-text)' }}
            >
              {project.name}
            </span>
          </button>

          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded font-bold uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30">
            {role}
          </span>
        </div>

        {/* Center: Quick Open / Command Search Box */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            onClick={() => setIsQuickOpen(true)}
            className="w-full flex items-center justify-between px-3 py-1 rounded-md text-xs border transition-all hover:border-sky-500"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text-muted)',
            }}
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 opacity-70" />
              <span>Search files ({project.name})</span>
            </div>
            <kbd 
              className="px-1.5 py-0.2 rounded text-[10px] border font-mono"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text-muted)',
              }}
            >
              Ctrl+P
            </kbd>
          </button>
        </div>

        {/* Right Tools & Presence */}
        <div className="flex items-center gap-2">
          {/* Peer Presence indicator */}
          <ProjectPresence
            projectId={projectId}
            activeFileId={activeFile?.id || null}
            activeFileName={activeFile?.name || null}
            members={members}
            isInVoice={isInVoice}
            voicePeers={voicePeers.map(vp => ({ userId: vp.userId, userName: vp.userName, isMuted: vp.isMuted }))}
            onPresenceChange={(peers) => {
              // Group peers by active file
              const fileMap: Record<string, { id: string; name: string; color: string }[]> = {};
              const peerList: any[] = [];
              peers.forEach(p => {
                peerList.push({
                  id: p.id,
                  name: p.name,
                  color: p.color,
                  currentFileId: p.currentFileId,
                  currentFileName: files.find(f => f.id === p.currentFileId)?.name || p.fileName,
                  inVoice: p.inVoice,
                });
                if (p.currentFileId) {
                  if (!fileMap[p.currentFileId]) fileMap[p.currentFileId] = [];
                  fileMap[p.currentFileId].push({ id: p.id, name: p.name, color: p.color });
                }
              });
              setCollaboratorsByFile(fileMap);
              setOnlinePeersList(peerList);
            }}
          />

          {/* GitHub Sync Button */}
          <button
            onClick={() => setIsGitHubOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--ide-text)' }}
            title="GitHub Integration"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden xl:inline text-[11px]">GitHub</span>
          </button>

          {/* Export Project ZIP */}
          <button
            onClick={handleExportProject}
            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--ide-text)' }}
            title="Export Project ZIP"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Invite Teammates */}
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--ide-accent)' }}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Invite</span>
          </button>

          {/* User Account Menu */}
          <UserMenu 
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
            onOpenSettingsModal={() => setIsSettingsOpen(true)}
            onOpenShortcutsModal={() => setIsShortcutsOpen(true)}
            onOpenDiscoveryModal={() => setIsDiscoveryOpen(true)}
            onViewPublicProfile={() => {
              if (user?.id) setSelectedPublicUserId(user.id);
            }}
          />
        </div>
      </header>

      {/* 2. Main Middle Workspace Layout */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Persistent Activity Bar */}
        <ActivityBar
          activeView={isSidebarOpen ? activeActivityView : null}
          onSelectView={handleSelectActivityView}
          collaboratorCount={members.length}
          gitChangedCount={0}
          unreadNotifications={notifications.filter(n => !n.read).length}
          onOpenSettings={() => setIsProfileModalOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(prev => !prev)}
          userAvatar={user?.avatar_url}
          userName={user?.full_name || 'User'}
        />

        {/* Collapsible Sidebar */}
        {isSidebarOpen && activeActivityView && (
          <div 
            className="h-full flex flex-col border-r flex-shrink-0 z-20 relative select-none"
            style={{
              width: `${sidebarWidth}px`,
              backgroundColor: 'var(--ide-sidebar)',
              borderColor: 'var(--ide-border)',
            }}
          >
            {/* Drag resize handle on right border */}
            <div
              onMouseDown={handleSidebarResizeStart}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 transition-colors z-30 select-none"
              title="Drag to resize sidebar width"
            />

            {activeActivityView === 'explorer' && (
              <FileTree
                files={files}
                activeFileId={activeFile?.id || null}
                onSelectFile={handleSelectFile}
                onOpenToSide={handleOpenToSide}
                onCreateFile={handleCreateFile}
                onRenameFile={handleRenameFile}
                onDeleteFile={handleDeleteFile}
                onUploadFiles={handleUploadFiles}
                onUploadFolder={handleUploadFolder}
                collaboratorsByFile={collaboratorsByFile}
              />
            )}

            {activeActivityView === 'search' && (
              <div className="flex flex-col h-full">
                <div className="p-3 border-b flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-neutral-400" style={{ borderColor: 'var(--ide-border)' }}>
                  <span>Search Workspace</span>
                  <button onClick={() => setIsGlobalSearchOpen(true)} className="p-1 hover:text-white rounded hover:bg-white/10" title="Full Search Window">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3">
                  <button
                    onClick={() => setIsGlobalSearchOpen(true)}
                    className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Open Global Search (Ctrl+Shift+F)</span>
                  </button>
                </div>
              </div>
            )}

            {activeActivityView === 'git' && (
              <div className="flex flex-col h-full overflow-hidden">
                <GitPanel
                  projectId={projectId}
                  projectName={project.name}
                  userName={user?.full_name || 'Anonymous Peer'}
                  userEmail={user?.email}
                  onActivityEvent={(d) => logAndBroadcastActivity('media_uploaded', d)}
                />
              </div>
            )}

            {activeActivityView === 'collaborators' && (
              <CollaboratorsPanel
                members={members}
                onlinePeers={onlinePeersList}
                voicePeers={voicePeers}
                isInVoice={isInVoice}
                onInviteClick={() => setIsInviteOpen(true)}
                onSelectMemberProfile={(uid) => setSelectedPublicUserId(uid)}
                onJumpToFile={(fid) => handleNavigateToLocation(fid)}
              />
            )}
          </div>
        )}

        {/* Center: Editor Area + Groups/Splits */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
          {/* Main Editor Center Container with Split Layout support */}
          <main className="flex-1 flex min-w-0 overflow-hidden relative">
            {/* Dock on Left (if orientation === 'left') */}
            {isDockOpen && dockOrientation === 'left' && (
              <BottomDock
                projectId={projectId}
                projectName={project.name}
                isOpen={isDockOpen}
                onClose={() => setIsDockOpen(false)}
                activeFileName={activeFile?.name}
                userId={user?.id || 'guest'}
                userName={user?.full_name || 'Anonymous Peer'}
                userEmail={user?.email}
                userAvatar={user?.avatar_url}
                userColor={userColor}
                unreadCount={unreadCount}
                onClearUnread={() => setUnreadCount(0)}
                onNewMessageReceived={() => {
                  if (!isDockOpen || activeDockTab !== 'chat') {
                    setUnreadCount((c) => c + 1);
                  }
                }}
                onActivityEvent={(details) => logAndBroadcastActivity('media_uploaded', details)}
                isInVoice={isInVoice}
                isMuted={isMuted}
                voicePeers={voicePeers}
                voiceConnectionState={voiceConnectionState}
                onJoinVoice={joinVoice}
                onLeaveVoice={leaveVoice}
                onToggleMute={toggleMute}
                orientation={dockOrientation}
                onChangeOrientation={handleOrientationChange}
                onOpenMediaInEditor={handleOpenMediaInEditor}
                problems={problems}
                onNavigateToProblem={handleNavigateToLocation}
                outputLogs={outputLogs}
                onClearOutputLogs={() => setOutputLogs([])}
                activeTab={activeDockTab}
                onTabChange={setActiveDockTab}
                onNavigateToFile={handleNavigateToLocation}
                theme={settings.theme}
              />
            )}

            <div 
              className={`flex-1 flex w-full h-full min-w-0 ${
                splitLayout === 'vertical'
                  ? 'flex-row divide-x'
                  : splitLayout === 'horizontal'
                  ? 'flex-col divide-y'
                  : 'flex-col'
              }`}
              style={{ borderColor: 'var(--ide-border)' }}
            >
              {editorGroups.map((group) => {
                const groupActiveFile = group.openFiles.find(f => f.id === group.activeFileId) || null;
                const isGroupActive = group.id === activeGroupId;

                return (
                  <div
                    key={group.id}
                    onClick={() => setActiveGroupId(group.id)}
                    className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative ${
                      isGroupActive ? 'ring-1 ring-inset ring-sky-500/20' : ''
                    }`}
                    style={{ backgroundColor: 'var(--ide-bg)' }}
                  >
                    {/* Tabs for this group */}
                    <OpenTabs
                      openFiles={group.openFiles}
                      activeFileId={group.activeFileId}
                      onSelectTab={(f) => handleSelectFile(f, group.id)}
                      onCloseTab={(fid) => handleCloseTabInGroup(group.id, fid)}
                      onCloseOthers={(fid) => handleCloseOthersInGroup(group.id, fid)}
                      onCloseToRight={(fid) => handleCloseToRightInGroup(group.id, fid)}
                      onCloseAll={() => handleCloseAllInGroup(group.id)}
                      onSplitRight={splitLayout === 'single' ? handleSplitRight : undefined}
                      onSplitDown={splitLayout === 'single' ? handleSplitDown : undefined}
                      onCloseGroup={splitLayout !== 'single' ? () => handleCloseGroup(group.id) : undefined}
                      canCloseGroup={splitLayout !== 'single'}
                      collaboratorsByFile={collaboratorsByFile}
                    />

                    {/* Breadcrumbs for this group */}
                    <Breadcrumbs
                      file={groupActiveFile}
                      allFiles={files}
                    />

                    {/* Editor / Media Content */}
                    <div className="flex-1 w-full h-full relative overflow-hidden">
                      {groupActiveFile ? (
                        (isMediaFile(groupActiveFile.name).isMedia || !!groupActiveFile.media_type) ? (
                          <MediaViewer
                            key={groupActiveFile.id}
                            file={groupActiveFile}
                            projectId={projectId}
                          />
                        ) : (
                          <MonacoEditorWrapper
                            key={groupActiveFile.id}
                            projectId={projectId}
                            file={groupActiveFile}
                            settings={settings}
                            targetLocation={isGroupActive ? targetJumpLocation : null}
                            onCloseActiveTab={handleCloseActiveTab}
                            onQuickOpen={() => setIsQuickOpen(true)}
                            onCommandPalette={() => setIsCommandPaletteOpen(true)}
                            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                            onToggleDock={() => setIsDockOpen((prev) => !prev)}
                            onSave={() => {}}
                            onContentSaved={(latestText) => {
                              setFiles((prev) =>
                                prev.map((f) => (f.id === groupActiveFile.id ? { ...f, content: latestText } : f))
                              );
                              setEditorGroups((prev) =>
                                prev.map((g) => ({
                                  ...g,
                                  openFiles: g.openFiles.map((f) => (f.id === groupActiveFile.id ? { ...f, content: latestText } : f)),
                                }))
                              );
                              syncFileToWorkspace(groupActiveFile.name, latestText);
                            }}
                            onCursorChange={(line, col) => {
                              if (isGroupActive) setCursorPos({ line, col });
                            }}
                            onProblemsChange={(newProblems) => {
                              setProblems((prev) => {
                                const filtered = prev.filter(p => p.fileId !== groupActiveFile.id);
                                return [...filtered, ...newProblems];
                              });
                            }}
                          />
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-3 select-none">
                          <Command className="w-12 h-12 text-neutral-600 opacity-60" />
                          <div className="text-center">
                            <p className="text-sm font-medium text-neutral-400">No file open in this editor</p>
                            <p className="text-xs text-neutral-500 mt-1">
                              Press <kbd className="px-1.5 py-0.5 rounded text-neutral-300 border border-neutral-700 bg-neutral-800">Ctrl+P</kbd> to quick open, or select a file from Explorer.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Contextual Chat Toast Notification in Editor */}
            {chatToast && (
              <div 
                className="absolute bottom-4 right-4 z-40 max-w-sm p-3 rounded-lg shadow-2xl border flex items-start gap-2.5 animate-in slide-in-from-bottom-3 duration-200"
                style={{
                  backgroundColor: 'var(--ide-card-bg)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <div className="mt-0.5">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[11px]">{chatToast.senderName}</span>
                    <button 
                      onClick={() => setChatToast(null)} 
                      className="text-neutral-500 hover:text-white p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-neutral-300 text-[11.5px] mt-0.5 line-clamp-2 leading-relaxed">{chatToast.message}</p>

                  <div className="flex items-center gap-2 mt-2">
                    {chatToast.filePath ? (
                      <button
                        onClick={() => {
                          handleNavigateToLocation(chatToast.filePath!, chatToast.line);
                          setChatToast(null);
                        }}
                        className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-[10.5px] flex items-center gap-1"
                      >
                        <FileCode className="w-3 h-3" />
                        <span>Open in Editor ({chatToast.filePath}:{chatToast.line || 1})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsDockOpen(true);
                          setActiveDockTab('chat');
                          setChatToast(null);
                        }}
                        className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-[10.5px]"
                      >
                        Open Chat
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Dock on Right (if orientation === 'right') */}
            {isDockOpen && dockOrientation === 'right' && (
              <BottomDock
                projectId={projectId}
                projectName={project.name}
                isOpen={isDockOpen}
                onClose={() => setIsDockOpen(false)}
                activeFileName={activeFile?.name}
                userId={user?.id || 'guest'}
                userName={user?.full_name || 'Anonymous Peer'}
                userEmail={user?.email}
                userAvatar={user?.avatar_url}
                userColor={userColor}
                unreadCount={unreadCount}
                onClearUnread={() => setUnreadCount(0)}
                onNewMessageReceived={() => {
                  if (!isDockOpen || activeDockTab !== 'chat') {
                    setUnreadCount((c) => c + 1);
                  }
                }}
                onActivityEvent={(details) => logAndBroadcastActivity('media_uploaded', details)}
                isInVoice={isInVoice}
                isMuted={isMuted}
                voicePeers={voicePeers}
                voiceConnectionState={voiceConnectionState}
                onJoinVoice={joinVoice}
                onLeaveVoice={leaveVoice}
                onToggleMute={toggleMute}
                orientation={dockOrientation}
                onChangeOrientation={handleOrientationChange}
                onOpenMediaInEditor={handleOpenMediaInEditor}
                problems={problems}
                onNavigateToProblem={handleNavigateToLocation}
                outputLogs={outputLogs}
                onClearOutputLogs={() => setOutputLogs([])}
                activeTab={activeDockTab}
                onTabChange={setActiveDockTab}
                onNavigateToFile={handleNavigateToLocation}
                theme={settings.theme}
              />
            )}
          </main>

          {/* Dock on Bottom (if orientation === 'bottom') */}
          {isDockOpen && dockOrientation === 'bottom' && (
            <BottomDock
              projectId={projectId}
              projectName={project.name}
              isOpen={isDockOpen}
              onClose={() => setIsDockOpen(false)}
              activeFileName={activeFile?.name}
              userId={user?.id || 'guest'}
              userName={user?.full_name || 'Anonymous Peer'}
              userEmail={user?.email}
              userAvatar={user?.avatar_url}
              userColor={userColor}
              unreadCount={unreadCount}
              onClearUnread={() => setUnreadCount(0)}
              onNewMessageReceived={() => {
                if (!isDockOpen || activeDockTab !== 'chat') {
                  setUnreadCount((c) => c + 1);
                }
              }}
              onActivityEvent={(details) => logAndBroadcastActivity('media_uploaded', details)}
              isInVoice={isInVoice}
              isMuted={isMuted}
              voicePeers={voicePeers}
              voiceConnectionState={voiceConnectionState}
              onJoinVoice={joinVoice}
              onLeaveVoice={leaveVoice}
              onToggleMute={toggleMute}
              orientation={dockOrientation}
              onChangeOrientation={handleOrientationChange}
              onOpenMediaInEditor={handleOpenMediaInEditor}
              problems={problems}
              onNavigateToProblem={handleNavigateToLocation}
              outputLogs={outputLogs}
              onClearOutputLogs={() => setOutputLogs([])}
              activeTab={activeDockTab}
              onTabChange={setActiveDockTab}
              onNavigateToFile={handleNavigateToLocation}
              theme={settings.theme}
            />
          )}

          {/* Dock in Fullscreen Overlay (if orientation === 'fullscreen') */}
          {isDockOpen && dockOrientation === 'fullscreen' && (
            <BottomDock
              projectId={projectId}
              projectName={project.name}
              isOpen={isDockOpen}
              onClose={() => setIsDockOpen(false)}
              activeFileName={activeFile?.name}
              userId={user?.id || 'guest'}
              userName={user?.full_name || 'Anonymous Peer'}
              userEmail={user?.email}
              userAvatar={user?.avatar_url}
              userColor={userColor}
              unreadCount={unreadCount}
              onClearUnread={() => setUnreadCount(0)}
              onNewMessageReceived={() => {
                if (!isDockOpen || activeDockTab !== 'chat') {
                  setUnreadCount((c) => c + 1);
                }
              }}
              onActivityEvent={(details) => logAndBroadcastActivity('media_uploaded', details)}
              isInVoice={isInVoice}
              isMuted={isMuted}
              voicePeers={voicePeers}
              voiceConnectionState={voiceConnectionState}
              onJoinVoice={joinVoice}
              onLeaveVoice={leaveVoice}
              onToggleMute={toggleMute}
              orientation={dockOrientation}
              onChangeOrientation={handleOrientationChange}
              onOpenMediaInEditor={handleOpenMediaInEditor}
              problems={problems}
              onNavigateToProblem={handleNavigateToLocation}
              outputLogs={outputLogs}
              onClearOutputLogs={() => setOutputLogs([])}
              activeTab={activeDockTab}
              onTabChange={setActiveDockTab}
              onNavigateToFile={handleNavigateToLocation}
              theme={settings.theme}
            />
          )}
        </div>
      </div>

      {/* 3. Bottom Developer Status Bar */}
      <footer 
        className="h-6 px-3 flex items-center justify-between text-[11px] font-medium select-none z-30"
        style={{
          backgroundColor: 'var(--ide-status-bg)',
          color: 'var(--ide-status-text)',
        }}
      >
        <div className="flex items-center gap-4">
          {/* Toggle Terminal / Dock Button */}
          <button
            onClick={() => {
              setIsDockOpen(!isDockOpen);
              if (!isDockOpen) setActiveDockTab('terminal');
            }}
            className="flex items-center gap-1.5 hover:underline font-semibold"
          >
            <Terminal className="w-3 h-3" />
            <span>{isDockOpen ? 'Hide Dock' : 'Terminal (Ctrl+`)'}</span>
          </button>

          {/* Git Branch Indicator */}
          <button
            onClick={() => {
              setIsDockOpen(true);
              setActiveDockTab('git');
            }}
            className="flex items-center gap-1 opacity-90 hover:opacity-100 hover:underline font-mono"
            title="Current Git Branch"
          >
            <GitBranch className="w-3 h-3" />
            <span>{currentGitBranch}</span>
          </button>

          {/* Problems Indicator */}
          <button
            onClick={() => {
              setIsDockOpen(true);
              setActiveDockTab('problems');
            }}
            className="flex items-center gap-1.5 opacity-90 hover:opacity-100 hover:underline"
            title="Diagnostics"
          >
            <AlertCircle className="w-3 h-3" />
            <span>{problems.filter(p => p.severity === 'error').length}</span>
            <AlertTriangle className="w-3 h-3 ml-1" />
            <span>{problems.filter(p => p.severity === 'warning').length}</span>
          </button>

          {/* Voice status */}
          {isInVoice && (
            <span className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded font-semibold text-emerald-200">
              <Mic className="w-3 h-3 animate-pulse" />
              <span>Voice ({voicePeers.length + 1})</span>
            </span>
          )}

          {/* Collaborator count */}
          <span className="flex items-center gap-1 opacity-90">
            <CheckCircle2 className="w-3 h-3 text-emerald-300" />
            <span>{members.length} Collaborator{members.length > 1 ? 's' : ''}</span>
          </span>
        </div>

        <div className="flex items-center gap-4 opacity-90">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>Spaces: {settings.tabSize}</span>
          <span>UTF-8</span>
          <span>LF</span>
          {activeFile && (
            <span className="uppercase font-semibold">{activeFile.language || 'TEXT'}</span>
          )}
          <span className="font-semibold">CodeCollab IDE</span>
        </div>
      </footer>

      {/* Notifications Popover */}
      <NotificationsPopover
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={() => {
          if (user) DataService.markAllNotificationsRead(user.id);
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }}
        onAcceptPartnerRequest={async (reqId) => {
          await DataService.respondToPartnerRequest(reqId, true);
          setNotifications(prev => prev.filter(n => n.partnerRequestId !== reqId));
        }}
        onDeclinePartnerRequest={async (reqId) => {
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

      {/* Modals & IDE Tools */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        project={project}
        members={members}
        onMemberAdded={(m) => setMembers((prev) => [...prev, m])}
        onMemberRemoved={(uid) => setMembers((prev) => prev.filter((m) => m.user_id !== uid))}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />

      <QuickOpenModal
        isOpen={isQuickOpen}
        onClose={() => setIsQuickOpen(false)}
        files={files}
        onSelectFile={handleSelectFile}
      />

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        files={files}
        onSelectFile={handleSelectFile}
      />

      <EditorSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />

      <GitHubModal
        isOpen={isGitHubOpen}
        onClose={() => setIsGitHubOpen(false)}
        projectId={projectId}
        projectName={project.name}
        currentBranch={currentGitBranch}
        onSyncComplete={() => {
          logAndBroadcastActivity('media_uploaded', 'Synchronized changes with GitHub');
          appendOutputLog('git', 'GitHub sync completed.');
        }}
      />

      {user && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={user}
          settings={settings}
          onUpdateSettings={updateSettings}
        />
      )}

      {selectedPublicUserId && (
        <PublicProfileModal
          isOpen={!!selectedPublicUserId}
          userId={selectedPublicUserId}
          currentUserId={user?.id || 'guest'}
          onClose={() => setSelectedPublicUserId(null)}
          onInviteToProject={() => {
            setSelectedPublicUserId(null);
            setIsInviteOpen(true);
          }}
        />
      )}

      <DeveloperDiscoveryModal
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
      />

      <ProjectSwitcherModal
        isOpen={isProjectSwitcherOpen}
        onClose={() => setIsProjectSwitcherOpen(false)}
        currentProjectId={projectId}
        userId={user?.id || 'guest'}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
