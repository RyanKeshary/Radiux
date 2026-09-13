'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Project, FileItem, ProjectMember } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { FileTree } from './FileTree';
import { OpenTabs } from './OpenTabs';
import { MonacoEditorWrapper } from './MonacoEditorWrapper';
import { ProjectPresence } from './ProjectPresence';
import { InviteMemberModal } from './InviteMemberModal';
import { UserSwitcher } from '@/components/auth/UserSwitcher';
import { 
  Code2, 
  ChevronLeft, 
  UserPlus, 
  Settings, 
  Terminal, 
  Loader2, 
  FileCode,
  Sparkles,
  Database,
  Share2
} from 'lucide-react';

interface WorkspaceProps {
  projectId: string;
}

export function Workspace({ projectId }: WorkspaceProps) {
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [openFiles, setOpenFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Load project, files, and members
  const loadWorkspaceData = useCallback(async () => {
    try {
      const [projData, filesData, membersData] = await Promise.all([
        DataService.getProject(projectId),
        DataService.getFiles(projectId),
        DataService.getMembers(projectId),
      ]);

      setProject(projData);
      setFiles(filesData);
      setMembers(membersData);

      // Open first non-folder file if no tabs open
      const firstCodeFile = filesData.find((f) => !f.is_folder);
      if (firstCodeFile && openFiles.length === 0) {
        setOpenFiles([firstCodeFile]);
        setActiveFileId(firstCodeFile.id);
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

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
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    try {
      await DataService.renameFile(fileId, newName);
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f))
      );
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await DataService.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId && f.parent_id !== fileId));
      handleCloseTab(fileId);
    } catch (err) {
      console.error(err);
    }
  };

  const activeFile = files.find((f) => f.id === activeFileId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#1e1e1e] text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <span className="text-sm font-medium">Entering collaborative workspace...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#1e1e1e] text-neutral-400 gap-4">
        <h2 className="text-lg font-bold text-white">Project Not Found</h2>
        <p className="text-xs">The project might have been removed or you do not have permission.</p>
        <Link href="/" className="px-4 py-2 bg-sky-600 text-white rounded text-xs font-medium">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
      {/* Top Navbar */}
      <header className="h-10 bg-[#333333] border-b border-[#252526] px-3 flex items-center justify-between select-none z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-xs text-neutral-300 hover:text-white px-2 py-1 rounded hover:bg-[#3e3e3e] transition-colors"
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
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-medium">
              Live Room
            </span>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2.5">
          {/* Active Collaborators Presence */}
          <ProjectPresence projectId={projectId} />

          {/* Share / Invite Collaborator Button */}
          <button
            onClick={() => setIsInviteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invite / Share</span>
          </button>

          {/* User profile switcher */}
          <UserSwitcher />
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
          />
        </aside>

        {/* Center / Right: Editor Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] overflow-hidden">
          {/* Tabs */}
          <OpenTabs
            openFiles={openFiles}
            activeFileId={activeFileId}
            onSelectTab={handleSelectFile}
            onCloseTab={handleCloseTab}
          />

          {/* Monaco Editor or Empty State */}
          <div className="flex-1 w-full h-full relative">
            {activeFile ? (
              <MonacoEditorWrapper
                key={activeFile.id}
                projectId={projectId}
                file={activeFile}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-3 select-none">
                <Code2 className="w-12 h-12 text-neutral-600" />
                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-400">No file is open</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Select a file from the explorer on the left or create a new one.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-6 bg-[#007acc] text-white px-3 flex items-center justify-between text-[11px] font-medium select-none z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            Connected
          </span>
          {activeFile && (
            <span>
              Language: <span className="font-semibold uppercase">{activeFile.language || 'TEXT'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sky-100">
          <span>UTF-8</span>
          <span>Spaces: 2</span>
          <span>CodeCollab Level 1</span>
        </div>
      </footer>

      {/* Invite modal */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        project={project}
        members={members}
        onMemberAdded={(m) => setMembers((prev) => [...prev, m])}
      />
    </div>
  );
}
