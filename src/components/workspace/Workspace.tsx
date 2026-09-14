'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Project, FileItem, ProjectMember, getUserColor, isMediaFile } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { FileTree } from './FileTree';
import { OpenTabs } from './OpenTabs';
import { MonacoEditorWrapper } from './MonacoEditorWrapper';
import { MediaViewer } from './MediaViewer';
import { ProjectPresence } from './ProjectPresence';
import { InviteMemberModal } from './InviteMemberModal';
import { UserMenu } from '@/components/auth/UserMenu';
import { CommandPalette, CommandItem } from './CommandPalette';
import { QuickOpenModal } from './QuickOpenModal';
import { GlobalSearchModal } from './GlobalSearchModal';
import { EditorSettingsModal, EditorSettings } from './EditorSettingsModal';
import { BottomDock, DockOrientation } from './BottomDock';
import { GitHubModal } from './GitHubModal';
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
  GitBranch
} from 'lucide-react';

interface WorkspaceProps {
  projectId: string;
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme: 'vs-dark',
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
  const [openFiles, setOpenFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const activeFileIdRef = useRef<string | null>(null);
  activeFileIdRef.current = activeFileId;
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // Level 4: Communication & Collaboration States
  const [unreadCount, setUnreadCount] = useState(0);
  const userColor = getUserColor(user?.id || 'guest');

  // Activity Broadcast helper
  const logAndBroadcastActivity = useCallback(async (actionType: any, details: string) => {
    try {
      const act = await DataService.logActivity(
        projectId,
        user?.id || 'guest',
        user?.full_name || 'Anonymous Peer',
        actionType,
        details
      );
      // Broadcast via comm room
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:1234/comm?projectId=${projectId}`;
      const tempWs = new WebSocket(wsUrl);
      tempWs.onopen = () => {
        tempWs.send(JSON.stringify({ type: 'activity_event', activity: act }));
        setTimeout(() => tempWs.close(), 300);
      };
    } catch (e) {}
  }, [projectId, user?.id, user?.full_name]);

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
  const [currentGitBranch, setCurrentGitBranch] = useState('main');
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

  const updateSettings = (newSettings: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        localStorage.setItem('codecollab_editor_settings', JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Sync file content to remote workspace filesystem
  const syncFileToWorkspace = (filePath: string, content: string) => {
    try {
      fetch('http://localhost:1234/api/sync-file', {
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
      const [projData, filesData, membersData] = await Promise.all([
        DataService.getProject(projectId),
        DataService.getFiles(projectId),
        DataService.getMembers(projectId),
      ]);

      setProject(projData);
      setFiles(filesData);
      setMembers(membersData);

      // Seed remote workspace disk with existing files
      try {
        fetch('http://localhost:1234/api/sync-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, files: filesData }),
        }).catch(() => {});
      } catch (e) {}

      // Open first code file if none open
      const firstCodeFile = filesData.find((f) => !f.is_folder);
      if (firstCodeFile && openFiles.length === 0) {
        setOpenFiles([firstCodeFile]);
        setActiveFileId(firstCodeFile.id);
      }

      // Record workspace entry in project activity timeline
      const sessionKey = `workspace_entered_${projectId}_${user.id}`;
      if (typeof window !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');
        logAndBroadcastActivity(
          'member_joined',
          `${user.full_name || 'A user'} entered the workspace`
        );
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, user, logAndBroadcastActivity]);

  useEffect(() => {
    if (user && !authLoading) {
      loadWorkspaceData();
    }
  }, [user, authLoading, loadWorkspaceData]);

  // Real-Time File-Tree Synchronization across peers via Yjs workspace room
  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
    const roomName = `project-${projectId}-filetree-sync`;
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);

    // Shared Map for notifying file-tree mutations (create, rename, delete)
    const ymap = ydoc.getMap('file-events');

    ymap.observe((event) => {
      DataService.getFiles(projectId).then((updatedFiles) => {
        setFiles((prevFiles) => {
          return updatedFiles.map((newF) => {
            if (newF.id === activeFileIdRef.current) {
              const currentActive = prevFiles.find((f) => f.id === newF.id);
              return currentActive ? { ...newF, content: currentActive.content } : newF;
            }
            return newF;
          });
        });
        setOpenFiles((prevOpen) => {
          return prevOpen
            .filter((tab) => updatedFiles.some((f) => f.id === tab.id))
            .map((tab) => {
              if (tab.id === activeFileIdRef.current) {
                return tab;
              }
              const fresh = updatedFiles.find((f) => f.id === tab.id);
              return fresh || tab;
            });
        });
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
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
    const roomName = `project-${projectId}-filetree-sync`;
    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    const ymap = ydoc.getMap('file-events');
    ymap.set('lastUpdate', Date.now());
    setTimeout(() => {
      provider.destroy();
      ydoc.destroy();
    }, 500);
  };

  // Keyboard shortcuts (Ctrl+K, Ctrl+P, Ctrl+Shift+F, Ctrl+`)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpen((prev) => !prev);
      } else if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      } else if (cmdOrCtrl && e.key === '`') {
        e.preventDefault();
        setIsDockOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // File tree handlers
  const handleSelectFile = (file: FileItem) => {
    if (file.is_folder) return;
    if (!openFiles.some((f) => f.id === file.id)) {
      setOpenFiles((prev) => [...prev, file]);
    }
    setActiveFileId(file.id);
  };

  const handleCloseTab = (fileId: string) => {
    const remaining = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(remaining);
    if (activeFileId === fileId) {
      setActiveFileId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const handleCreateFile = async (parentId: string | null, name: string, isFolder: boolean) => {
    try {
      const newFile = await DataService.createFile(projectId, parentId, name, isFolder);
      setFiles((prev) => [...prev, newFile]);
      if (!isFolder) {
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newFile.id);
        syncFileToWorkspace(name, newFile.content || '');
      }
      broadcastFileChange();
      logAndBroadcastActivity(
        'file_created',
        `Created ${isFolder ? 'folder' : 'file'} "${name}"`
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    try {
      const oldFile = files.find((f) => f.id === fileId);
      await DataService.renameFile(fileId, newName);
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f))
      );
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f))
      );
      broadcastFileChange();
      logAndBroadcastActivity(
        'file_renamed',
        `Renamed "${oldFile?.name || 'file'}" → "${newName}"`
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const oldFile = files.find((f) => f.id === fileId);
      await DataService.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId && f.parent_id !== fileId));
      handleCloseTab(fileId);
      broadcastFileChange();
      logAndBroadcastActivity(
        'file_deleted',
        `Deleted "${oldFile?.name || 'file'}"`
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadFiles = async (parentId: string | null, uploadedFiles: FileList) => {
    try {
      const fileArray = Array.from(uploadedFiles);
      for (const f of fileArray) {
        // Read file as base64 Data URL to save in database & disk
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
        setOpenFiles((prev) => [...prev.filter((item) => item.id !== newFile.id), newFile]);
        setActiveFileId(newFile.id);

        // Sync to remote workspace disk
        syncFileToWorkspace(newFile.name, base64DataUrl);

        logAndBroadcastActivity(
          'media_uploaded',
          `Uploaded file "${f.name}" (${(f.size / 1024).toFixed(1)} KB)`
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
      const createdFolders = new Map<string, string>(); // relPath -> folderId

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

  // Export individual project as ZIP
  const handleExportProject = async () => {
    if (!project) return;
    try {
      await DataService.exportProjectAsZip(project);
    } catch (err) {
      console.error('Project export failed:', err);
      alert('Failed to export project ZIP');
    }
  };

  const activeFile = files.find((f) => f.id === activeFileId);

  // Command Palette Items
  const commands: CommandItem[] = [
    {
      id: 'toggle-terminal',
      title: 'Toggle Terminal / Preview Dock',
      category: 'View',
      shortcut: 'Ctrl+`',
      icon: <Terminal className="w-4 h-4 text-sky-400" />,
      action: () => setIsDockOpen((prev) => !prev),
    },
    {
      id: 'quick-open',
      title: 'Quick Open File...',
      category: 'Files',
      shortcut: 'Ctrl+P',
      icon: <FileSearch className="w-4 h-4" />,
      action: () => setIsQuickOpen(true),
    },
    {
      id: 'global-search',
      title: 'Search Across Project...',
      category: 'Search',
      shortcut: 'Ctrl+Shift+F',
      icon: <Search className="w-4 h-4" />,
      action: () => setIsGlobalSearchOpen(true),
    },
    {
      id: 'new-file',
      title: 'Create New File in Root',
      category: 'Explorer',
      icon: <FilePlus className="w-4 h-4" />,
      action: () => {
        const name = prompt('Enter new file name:');
        if (name?.trim()) handleCreateFile(null, name.trim(), false);
      },
    },
    {
      id: 'new-folder',
      title: 'Create New Folder in Root',
      category: 'Explorer',
      icon: <FolderPlus className="w-4 h-4" />,
      action: () => {
        const name = prompt('Enter new folder name:');
        if (name?.trim()) handleCreateFile(null, name.trim(), true);
      },
    },
    {
      id: 'settings',
      title: 'Open Editor Settings',
      category: 'Preferences',
      icon: <Settings className="w-4 h-4" />,
      action: () => setIsSettingsOpen(true),
    },
    {
      id: 'invite',
      title: 'Invite Collaborators / Manage Members',
      category: 'Collaboration',
      icon: <UserPlus className="w-4 h-4" />,
      action: () => setIsInviteOpen(true),
    },
  ];

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#1e1e1e] text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <span className="text-sm font-medium">Authenticating & entering collaborative workspace...</span>
      </div>
    );
  }

  // Unauthorized screen
  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#181818] text-neutral-400 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Denied (403)</h2>
        <p className="text-xs text-neutral-400 max-w-sm mb-6">
          You are not authorized to view or edit this project. You must be added as a member by the project owner.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#1e1e1e] text-neutral-400 gap-4">
        <h2 className="text-lg font-bold text-white">Project Not Found</h2>
        <p className="text-xs">The project may have been deleted.</p>
        <Link href="/" className="px-4 py-2 bg-sky-600 text-white rounded text-xs font-medium">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
      {/* Top Navbar */}
      <header className="h-10 bg-[#252526] border-b border-[#333333] px-3 flex items-center justify-between select-none z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs text-neutral-300 hover:text-white px-2 py-1 rounded hover:bg-[#333333] transition-colors"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-semibold hidden sm:inline">Projects</span>
          </Link>

          <div className="h-4 w-px bg-neutral-600" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">
              {project.name}
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
              role === 'owner' 
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {role === 'owner' ? 'Owner' : 'Member'}
            </span>
          </div>
        </div>

        {/* Center Quick Search Button */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-neutral-400 hover:text-white rounded-lg border border-[#3c3c3c] text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search commands & files...</span>
            <kbd className="text-[10px] bg-[#333333] px-1.5 py-0.5 rounded border border-[#444444]">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Toggle Terminal / Comm Dock Button */}
          <button
            onClick={() => setIsDockOpen(!isDockOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
              isDockOpen
                ? 'bg-sky-600 text-white border-sky-500'
                : 'bg-[#1e1e1e] text-neutral-300 hover:text-white border-[#3c3c3c] hover:bg-[#2a2a2a]'
            }`}
            title="Toggle Terminal & Communication Dock (Ctrl+`)"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dock</span>
            {unreadCount > 0 && !isDockOpen && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Quick Voice Call Indicator Button */}
          {isInVoice ? (
            <button
              onClick={() => setIsDockOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium animate-pulse"
              title="You are in voice chat. Click to open dock."
            >
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Voice Active</span>
            </button>
          ) : voicePeers.length > 0 ? (
            <button
              onClick={() => {
                setIsDockOpen(true);
                joinVoice();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-[#3c3c3c] text-xs font-medium"
              title="Collaborators are in voice. Click to join."
            >
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Join Voice ({voicePeers.length})</span>
            </button>
          ) : null}

          {/* Active Collaborators Presence */}
          <ProjectPresence
            projectId={projectId}
            activeFileId={activeFileId}
            activeFileName={activeFile ? activeFile.name : null}
            members={members}
            isInVoice={isInVoice}
            voicePeers={voicePeers}
          />

          {/* Export Project ZIP Button */}
          <button
            onClick={handleExportProject}
            title="Export Project as ZIP"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-neutral-300 hover:text-white border border-[#3c3c3c] text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Export</span>
          </button>

          {/* GitHub Sync Button */}
          <button
            onClick={() => setIsGitHubOpen(true)}
            title="Connect & Sync with GitHub"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1e1e1e] hover:bg-[#2a2a2a] text-neutral-300 hover:text-white border border-[#3c3c3c] text-xs font-medium transition-colors"
          >
            <Github className="w-3.5 h-3.5 text-neutral-300" />
            <span className="hidden lg:inline">GitHub</span>
          </button>

          {/* Share / Invite Collaborators Button */}
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Collaborators</span>
          </button>

          {/* Editor Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Editor Settings"
            className="p-1.5 rounded hover:bg-[#333333] text-neutral-400 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User profile dropdown */}
          <UserMenu />
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: File Tree */}
        <aside className="w-64 border-r border-[#3c3c3c] bg-[#252526] flex flex-col flex-shrink-0">
          <FileTree
            files={files}
            activeFileId={activeFileId}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onRenameFile={handleRenameFile}
            onDeleteFile={handleDeleteFile}
            onUploadFiles={handleUploadFiles}
            onUploadFolder={handleUploadFolder}
          />
        </aside>

        {/* Center / Right: Editor Area + Dock in left/right/bottom orientation */}
        <div className={`flex-1 flex min-w-0 bg-[#1e1e1e] overflow-hidden ${
          isDockOpen && (dockOrientation === 'left' || dockOrientation === 'right')
            ? 'flex-row'
            : 'flex-col'
        }`}>
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
                if (!isDockOpen) {
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
            />
          )}

          {/* Main Editor Center Area */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] overflow-hidden relative">
            {/* Tabs */}
            <OpenTabs
              openFiles={openFiles}
              activeFileId={activeFileId}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
            />

            {/* Media Viewer, Monaco Editor, or Empty State */}
            <div className="flex-1 w-full h-full relative overflow-hidden">
              {activeFile ? (
                isMediaFile(activeFile.name).isMedia ? (
                  <MediaViewer
                    key={activeFile.id}
                    file={activeFile}
                    projectId={projectId}
                  />
                ) : (
                  <MonacoEditorWrapper
                    key={activeFile.id}
                    projectId={projectId}
                    file={activeFile}
                    settings={settings}
                    onContentSaved={(latestText) => {
                      setFiles((prev) =>
                        prev.map((f) => (f.id === activeFile.id ? { ...f, content: latestText } : f))
                      );
                      setOpenFiles((prev) =>
                        prev.map((f) => (f.id === activeFile.id ? { ...f, content: latestText } : f))
                      );
                      syncFileToWorkspace(activeFile.name, latestText);
                    }}
                    onCursorChange={(line, col) => setCursorPos({ line, col })}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-3 select-none">
                  <Command className="w-12 h-12 text-neutral-600" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-neutral-400">No file is open</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Press <kbd className="px-1.5 py-0.5 bg-[#252526] rounded text-neutral-300 border border-[#3c3c3c]">Ctrl+P</kbd> to open a file, or <kbd className="px-1.5 py-0.5 bg-[#252526] rounded text-neutral-300 border border-[#3c3c3c]">Ctrl+`</kbd> to open terminal.
                    </p>
                  </div>
                </div>
              )}
            </div>

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
                  if (!isDockOpen) {
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
              />
            )}
          </main>

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
                if (!isDockOpen) {
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
                if (!isDockOpen) {
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
            />
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-6 bg-[#007acc] text-white px-3 flex items-center justify-between text-[11px] font-medium select-none z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDockOpen(!isDockOpen)}
            className="flex items-center gap-1.5 hover:underline font-semibold"
          >
            <Terminal className="w-3 h-3" />
            <span>{isDockOpen ? 'Hide Dock' : 'Dock (Ctrl+`)'}</span>
          </button>

          {/* Git Branch Indicator */}
          <button
            onClick={() => setIsDockOpen(true)}
            className="flex items-center gap-1 text-sky-200 hover:text-white hover:underline font-mono"
            title="Current Git Branch. Click to open Source Control."
          >
            <GitBranch className="w-3 h-3 text-sky-300" />
            <span>{currentGitBranch}</span>
          </button>

          {isInVoice && (
            <span className="flex items-center gap-1 text-emerald-200 bg-emerald-700/50 px-2 py-0.5 rounded font-semibold">
              <Mic className="w-3 h-3 text-emerald-300 animate-pulse" />
              <span>Voice: {isMuted ? 'Muted' : 'Speaking'} ({voicePeers.length + 1})</span>
            </span>
          )}

          {activeFile && (
            <span>
              Language: <span className="font-semibold uppercase">{activeFile.language || 'TEXT'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sky-100">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>Spaces: {settings.tabSize}</span>
          <span>UTF-8</span>
          <span className="font-semibold">CodeCollab Level 5</span>
        </div>
      </footer>

      {/* Modals & Tools */}
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
        }}
      />
    </div>
  );
}
