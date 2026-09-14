import JSZip from 'jszip';
import { supabase, isSupabaseConfigured } from './supabase/client';
import { StorageMock } from './storage-mock';
import { buildApiUrl } from './config';
import { 
  Project, 
  ProjectMember, 
  FileItem, 
  UserProfile, 
  detectLanguage, 
  ChatMessage, 
  ActivityEvent,
  ActivityActionType,
  GitStatus,
  GitCommit,
  GitBranch,
  GitHubRemote,
  WorkspaceExportManifest
} from './types';

export const DataService = {
  isSupabaseActive(): boolean {
    return isSupabaseConfigured;
  },

  // Lookup registered user by email
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', email.trim())
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
    };
  },

  // Check if a user has access to a project
  async verifyProjectAccess(projectId: string, userId: string): Promise<{ authorized: boolean; role?: 'owner' | 'member' }> {
    // 1. Try Supabase
    if (isSupabaseConfigured && supabase) {
      const { data: proj, error: projError } = await supabase
        .from('projects')
        .select('id, owner_id')
        .eq('id', projectId)
        .single();

      if (!projError && proj) {
        if (proj.owner_id === userId) {
          return { authorized: true, role: 'owner' };
        }
        const { data: member } = await supabase
          .from('project_members')
          .select('id, role')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .single();

        if (member) {
          return { authorized: true, role: member.role as 'owner' | 'member' };
        }
        return { authorized: false };
      }
    }

    // 2. Check Local Storage fallback (if created during offline/local fallback)
    const localProj = StorageMock.getProject(projectId);
    if (localProj) {
      const isOwner = localProj.owner_id === userId;
      const members = StorageMock.getMembers(projectId);
      const isMember = members.some(m => m.user_id === userId);
      if (isOwner || isMember) {
        return { authorized: true, role: isOwner ? 'owner' : 'member' };
      }
    }

    return { authorized: false };
  },

  // Projects
  async getProjects(userId: string): Promise<Project[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        return data.map((p: any) => ({
          ...p,
          role: p.owner_id === userId ? 'owner' : 'member'
        }));
      }
    }
    return StorageMock.getProjects(userId);
  },

  async getProject(projectId: string): Promise<Project | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (!error && data) {
        return data;
      }
    }
    return StorageMock.getProject(projectId);
  },

  async createProject(name: string, description: string, user: UserProfile): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          description,
          owner_id: user.id
        })
        .select()
        .single();

      if (!error && data) {
        // Add owner to members table
        await supabase.from('project_members').insert({
          project_id: data.id,
          user_id: user.id,
          role: 'owner'
        });

        // Add starter index.js
        await supabase.from('files').insert({
          project_id: data.id,
          name: 'index.js',
          is_folder: false,
          language: 'javascript',
          content: `// Project: ${name}\n// Created by ${user.full_name}\n\nconsole.log("Welcome to CodeCollab!");\n`
        });

        return data;
      }
      console.warn('Supabase createProject failed, storing locally:', error?.message);
    }

    return StorageMock.createProject(name, description, user);
  },

  // Members
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('project_members')
        .select('*, profile:profiles(*)')
        .eq('project_id', projectId);

      if (!error && data) {
        return data;
      }
    }
    return StorageMock.getMembers(projectId);
  },

  async addMember(projectId: string, user: UserProfile): Promise<ProjectMember> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: user.id,
          role: 'member'
        })
        .select('*, profile:profiles(*)')
        .single();

      if (!error && data) {
        return data;
      }
    }
    return StorageMock.addMember(projectId, user);
  },

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      return !error;
    }
    return true;
  },

  // Files
  async getFiles(projectId: string): Promise<FileItem[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .order('is_folder', { ascending: false })
        .order('name', { ascending: true });

      if (!error && data) {
        return data.map((f) => ({
          ...f,
          language: !f.is_folder ? detectLanguage(f.name) : undefined,
        }));
      }
    }
    return StorageMock.getFiles(projectId);
  },

  async createFile(
    projectId: string, 
    parentId: string | null, 
    name: string, 
    isFolder: boolean,
    initialContent?: string
  ): Promise<FileItem> {
    const language = isFolder ? undefined : detectLanguage(name);
    const content = isFolder ? '' : (initialContent !== undefined ? initialContent : `// ${name}\n`);
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('files')
        .insert({
          project_id: projectId,
          parent_id: parentId,
          name,
          is_folder: isFolder,
          language,
          content,
        })
        .select()
        .single();

      if (!error && data) {
        return {
          ...data,
          language,
        };
      }
    }
    return StorageMock.createFile(projectId, parentId, name, isFolder, initialContent);
  },

  async renameFile(fileId: string, newName: string): Promise<boolean> {
    const language = detectLanguage(newName);
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('files')
        .update({ 
          name: newName, 
          language,
          updated_at: new Date().toISOString() 
        })
        .eq('id', fileId);

      if (!error) return true;
    }
    return StorageMock.renameFile(fileId, newName);
  },

  async deleteFile(fileId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);

      if (!error) return true;
    }
    return StorageMock.deleteFile(fileId);
  },

  async updateFileContent(fileId: string, content: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('files')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', fileId);

      if (!error) return true;
    }
    return StorageMock.updateFileContent(fileId, content);
  },

  // ============================================================================
  // Level 4: Project Chat & Activity Persistence
  // ============================================================================

  async getMessages(projectId: string): Promise<ChatMessage[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(150);

      if (!error && data) {
        return data as ChatMessage[];
      }
    }
    return StorageMock.getMessages(projectId);
  },

  async sendMessage(
    projectId: string,
    userId: string,
    userName: string,
    userAvatar: string | undefined,
    content: string,
    media?: {
      type: 'image' | 'video' | 'audio' | 'file';
      url: string; // base64 data URL or existing URL
      name: string;
    }
  ): Promise<ChatMessage> {
    // Level 6: Upload media to Supabase Storage instead of storing base64 in DB
    let mediaUrl = media?.url;
    if (media && mediaUrl && mediaUrl.startsWith('data:') && isSupabaseConfigured && supabase) {
      try {
        // Convert base64 data URL to Blob
        const [header, base64Data] = mediaUrl.split(',');
        const mimeMatch = header.match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const byteString = atob(base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: mimeType });

        // Upload to chat-media bucket: {userId}/{timestamp}-{fileName}
        const ext = media.name.split('.').pop() || 'bin';
        const storagePath = `${userId}/${Date.now()}-${media.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(storagePath, blob, { contentType: mimeType, upsert: false });

        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(storagePath);
          mediaUrl = publicUrl;
        }
        // If upload fails, fall back to base64 (will work but not ideal for production)
      } catch (storageErr) {
        console.warn('[DataService] Media upload to Storage failed, using base64 fallback:', storageErr);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          project_id: projectId,
          user_id: userId,
          user_name: userName,
          user_avatar: userAvatar || '',
          content: content.trim(),
          media_type: media?.type,
          media_url: mediaUrl,
          media_name: media?.name,
        })
        .select()
        .single();

      if (!error && data) {
        StorageMock.saveMessage(data);
        return data as ChatMessage;
      }
    }
    return StorageMock.saveMessage({
      project_id: projectId,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar,
      content: content.trim(),
      media_type: media?.type,
      media_url: mediaUrl,
      media_name: media?.name,
    });
  },

  async getActivities(projectId: string): Promise<ActivityEvent[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        return data as ActivityEvent[];
      }
    }
    return StorageMock.getActivities(projectId);
  },

  async logActivity(
    projectId: string,
    userId: string,
    userName: string,
    actionType: ActivityActionType,
    details: string,
    targetObject?: string
  ): Promise<ActivityEvent> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          project_id: projectId,
          user_id: userId,
          user_name: userName,
          action_type: actionType,
          details: details.trim(),
          target_object: targetObject || '',
        })
        .select()
        .single();

      if (!error && data) {
        StorageMock.logActivity(data);
        return data as ActivityEvent;
      }
    }
    return StorageMock.logActivity({
      project_id: projectId,
      user_id: userId,
      user_name: userName,
      action_type: actionType,
      details: details.trim(),
      target_object: targetObject || '',
    });
  },

  // ==========================================================================
  // Level 5 & 6: Git & Workspace API Client Methods
  // ==========================================================================
  getApiBaseUrl(): string {
    return buildApiUrl('');
  },

  async getGitStatus(projectId: string): Promise<GitStatus> {
    try {
      const res = await fetch(`${this.getApiBaseUrl()}/api/git/status?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch git status');
      return await res.json();
    } catch (err: any) {
      return {
        isRepo: false,
        branch: null,
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        clean: true,
        error: err.message,
      };
    }
  },

  async initGit(projectId: string, userName?: string, userEmail?: string): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, userName, userEmail }),
    });
    return await res.json();
  },

  async stageGitFiles(projectId: string, files: string[] | 'all'): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, files: files === 'all' ? '.' : files }),
    });
    return await res.json();
  },

  async unstageGitFiles(projectId: string, files: string[] | 'all'): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/unstage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, files: files === 'all' ? '.' : files }),
    });
    return await res.json();
  },

  async discardGitFiles(projectId: string, files: string[]): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/discard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, files }),
    });
    return await res.json();
  },

  async commitGit(
    projectId: string,
    message: string,
    userName?: string,
    userEmail?: string
  ): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, message, userName, userEmail }),
    });
    return await res.json();
  },

  async getGitLog(projectId: string, limit = 50): Promise<GitCommit[]> {
    try {
      const res = await fetch(`${this.getApiBaseUrl()}/api/git/log?projectId=${projectId}&limit=${limit}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.commits || [];
    } catch {
      return [];
    }
  },

  async getGitDiff(
    projectId: string,
    options: { file?: string; staged?: boolean; commit?: string } = {}
  ): Promise<{ success: boolean; diff: string; error?: string }> {
    try {
      const params = new URLSearchParams({ projectId });
      if (options.file) params.append('file', options.file);
      if (options.staged) params.append('staged', 'true');
      if (options.commit) params.append('commit', options.commit);

      const res = await fetch(`${this.getApiBaseUrl()}/api/git/diff?${params.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, diff: '', error: err.message };
    }
  },

  async getGitBranches(projectId: string): Promise<{ current: string; branches: GitBranch[] }> {
    try {
      const res = await fetch(`${this.getApiBaseUrl()}/api/git/branches?projectId=${projectId}`);
      if (!res.ok) return { current: 'main', branches: [{ name: 'main', isCurrent: true }] };
      return await res.json();
    } catch {
      return { current: 'main', branches: [{ name: 'main', isCurrent: true }] };
    }
  },

  async createGitBranch(projectId: string, branchName: string): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/branch/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, branchName }),
    });
    return await res.json();
  },

  async switchGitBranch(projectId: string, branchName: string): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/branch/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, branchName }),
    });
    return await res.json();
  },

  async deleteGitBranch(projectId: string, branchName: string): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/branch/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, branchName }),
    });
    return await res.json();
  },

  async mergeGitBranch(projectId: string, branchName: string): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, branchName }),
    });
    return await res.json();
  },

  async getGitHubRemotes(projectId: string): Promise<GitHubRemote[]> {
    try {
      const res = await fetch(`${this.getApiBaseUrl()}/api/git/remotes?projectId=${projectId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.remotes || [];
    } catch {
      return [];
    }
  },

  async setGitHubRemote(projectId: string, url: string, name = 'origin'): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/remote/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name, url }),
    });
    return await res.json();
  },

  async disconnectGitHubRemote(projectId: string, name = 'origin'): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/remote/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name }),
    });
    return await res.json();
  },

  async pushToGitHub(
    projectId: string,
    branch?: string,
    token?: string,
    remote = 'origin'
  ): Promise<{ success: boolean; stderr?: string; stdout?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, branch, token, remote }),
    });
    return await res.json();
  },

  async pullFromGitHub(
    projectId: string,
    branch?: string,
    token?: string,
    remote = 'origin'
  ): Promise<{ success: boolean; stderr?: string; stdout?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, branch, token, remote }),
    });
    return await res.json();
  },

  async cloneFromGitHub(
    projectId: string,
    repoUrl: string,
    token?: string
  ): Promise<{ success: boolean; stderr?: string }> {
    const res = await fetch(`${this.getApiBaseUrl()}/api/git/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, repoUrl, token }),
    });
    return await res.json();
  },

  // ==========================================================================
  // Level 5: Export & Import System (ZIP & Folder)
  // ==========================================================================

  /**
   * Export an individual project as a clean, extractable ZIP archive.
   */
  async exportProjectAsZip(project: Project): Promise<void> {
    const files = await this.getFiles(project.id);
    const zip = new JSZip();

    // Map parent_id to folder path
    const folderMap = new Map<string, string>();

    // Pass 1: Build folder paths
    const getFolderPath = (folderItem: FileItem): string => {
      if (!folderItem.parent_id) return folderItem.name;
      const parent = files.find(f => f.id === folderItem.parent_id);
      if (parent) {
        return `${getFolderPath(parent)}/${folderItem.name}`;
      }
      return folderItem.name;
    };

    files.forEach(f => {
      if (f.is_folder) {
        folderMap.set(f.id, getFolderPath(f));
      }
    });

    // Pass 2: Add files and folders to ZIP
    for (const f of files) {
      if (f.is_folder) {
        const folderPath = folderMap.get(f.id);
        if (folderPath) {
          zip.folder(folderPath);
        }
      } else {
        const parentPath = f.parent_id ? folderMap.get(f.parent_id) : '';
        const filePath = parentPath ? `${parentPath}/${f.name}` : f.name;

        if (f.content?.startsWith('data:') && f.content.includes(';base64,')) {
          // Binary media file (image/video/audio)
          const base64Data = f.content.split(';base64,')[1];
          zip.file(filePath, base64Data, { base64: true });
        } else {
          zip.file(filePath, f.content || '');
        }
      }
    }

    // Generate ZIP blob and trigger browser download
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const cleanProjectName = project.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `${cleanProjectName || 'project'}.zip`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Export all user projects into a complete workspace archive codecollab-workspace.zip
   */
  async exportCompleteWorkspace(userId: string, workspaceName = 'codecollab-workspace'): Promise<void> {
    const projects = await this.getProjects(userId);
    const zip = new JSZip();

    const manifest: WorkspaceExportManifest = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      workspace_name: workspaceName,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        created_at: p.created_at,
      })),
    };

    // Add workspace.json manifest
    zip.file('workspace.json', JSON.stringify(manifest, null, 2));

    // Bundle each project into its own folder inside the zip
    for (const project of projects) {
      const projFolder = zip.folder(project.name.replace(/[^a-zA-Z0-9_-]/g, '_'));
      if (!projFolder) continue;

      const files = await this.getFiles(project.id);
      const folderMap = new Map<string, string>();

      const getFolderPath = (folderItem: FileItem): string => {
        if (!folderItem.parent_id) return folderItem.name;
        const parent = files.find(f => f.id === folderItem.parent_id);
        if (parent) {
          return `${getFolderPath(parent)}/${folderItem.name}`;
        }
        return folderItem.name;
      };

      files.forEach(f => {
        if (f.is_folder) {
          folderMap.set(f.id, getFolderPath(f));
        }
      });

      for (const f of files) {
        if (f.is_folder) {
          const folderPath = folderMap.get(f.id);
          if (folderPath) projFolder.folder(folderPath);
        } else {
          const parentPath = f.parent_id ? folderMap.get(f.parent_id) : '';
          const filePath = parentPath ? `${parentPath}/${f.name}` : f.name;

          if (f.content?.startsWith('data:') && f.content.includes(';base64,')) {
            const base64Data = f.content.split(';base64,')[1];
            projFolder.file(filePath, base64Data, { base64: true });
          } else {
            projFolder.file(filePath, f.content || '');
          }
        }
      }
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspaceName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Import project from a ZIP file archive.
   */
  async importProjectFromZip(file: File, user: UserProfile, customName?: string): Promise<Project> {
    const projectName = customName || file.name.replace(/\.[^/.]+$/, '') || 'Imported Project';
    const project = await this.createProject(projectName, 'Imported from ZIP archive', user);

    const zip = await JSZip.loadAsync(file);
    const createdFolders = new Map<string, string>(); // relativeFolderPath -> dbFolderId

    // Helper to get or create nested folders in database
    const ensureFolder = async (folderPath: string): Promise<string | null> => {
      const normalized = folderPath.replace(/\/$/, '').trim();
      if (!normalized) return null;
      if (createdFolders.has(normalized)) return createdFolders.get(normalized)!;

      const segments = normalized.split('/');
      let currentPath = '';
      let parentId: string | null = null;

      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        if (createdFolders.has(currentPath)) {
          parentId = createdFolders.get(currentPath)!;
        } else {
          // Security: Prevent malicious path traversal
          if (segment === '..' || segment === '.') continue;
          const folderItem = await this.createFile(project.id, parentId, segment, true);
          createdFolders.set(currentPath, folderItem.id);
          parentId = folderItem.id;
        }
      }
      return parentId;
    };

    // Iterate through zip entries
    for (const [relPath, zipEntry] of Object.entries(zip.files)) {
      // Security: Prevent zip slip path traversal
      if (relPath.includes('../') || relPath.startsWith('/') || relPath.startsWith('\\')) {
        continue;
      }
      // Skip hidden system/git metadata files
      if (relPath.startsWith('__MACOSX') || relPath.includes('/.DS_Store') || relPath.startsWith('.git/')) {
        continue;
      }

      if (zipEntry.dir) {
        await ensureFolder(relPath);
      } else {
        const lastSlash = relPath.lastIndexOf('/');
        const dirPath = lastSlash !== -1 ? relPath.substring(0, lastSlash) : '';
        const fileName = lastSlash !== -1 ? relPath.substring(lastSlash + 1) : relPath;

        if (!fileName || fileName.startsWith('.')) continue;

        const parentId = dirPath ? await ensureFolder(dirPath) : null;
        let content = '';

        const ext = fileName.split('.').pop()?.toLowerCase();
        const isBinary = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(ext || '');

        if (isBinary) {
          const b64 = await zipEntry.async('base64');
          const mime = ext === 'png' ? 'image/png' : ext === 'mp4' ? 'video/mp4' : 'application/octet-stream';
          content = `data:${mime};base64,${b64}`;
        } else {
          content = await zipEntry.async('text');
        }

        await this.createFile(project.id, parentId, fileName, false, content);
      }
    }

    return project;
  },

  /**
   * Import project from a local folder (webkitdirectory upload).
   */
  async importProjectFromFolder(
    files: FileList | File[],
    user: UserProfile,
    customName?: string
  ): Promise<Project> {
    const fileArray = Array.from(files);
    // Derive project name from top-level relative path if available
    let inferredName = 'Imported Project';
    if (fileArray.length > 0 && (fileArray[0] as any).webkitRelativePath) {
      const topDir = (fileArray[0] as any).webkitRelativePath.split('/')[0];
      if (topDir) inferredName = topDir;
    }

    const projectName = customName || inferredName;
    const project = await this.createProject(projectName, 'Imported from local folder', user);

    const createdFolders = new Map<string, string>(); // relativeFolderPath -> dbFolderId

    const ensureFolder = async (folderPath: string): Promise<string | null> => {
      const normalized = folderPath.replace(/\/$/, '').trim();
      if (!normalized) return null;
      if (createdFolders.has(normalized)) return createdFolders.get(normalized)!;

      const segments = normalized.split('/');
      let currentPath = '';
      let parentId: string | null = null;

      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        if (createdFolders.has(currentPath)) {
          parentId = createdFolders.get(currentPath)!;
        } else {
          if (segment === '..' || segment === '.') continue;
          const folderItem = await this.createFile(project.id, parentId, segment, true);
          createdFolders.set(currentPath, folderItem.id);
          parentId = folderItem.id;
        }
      }
      return parentId;
    };

    for (const f of fileArray) {
      const relPath = (f as any).webkitRelativePath || f.name;
      // Skip node_modules and .git in local folder import to keep it lightweight and fast
      if (relPath.includes('node_modules/') || relPath.includes('.git/')) {
        continue;
      }

      // Security check
      if (relPath.includes('..')) continue;

      // Remove top-level folder name prefix if webkitRelativePath
      const parts = relPath.split('/');
      const innerParts = parts.length > 1 ? parts.slice(1) : parts;
      const fileName = innerParts[innerParts.length - 1];
      const dirPath = innerParts.length > 1 ? innerParts.slice(0, innerParts.length - 1).join('/') : '';

      if (!fileName) continue;

      const parentId = dirPath ? await ensureFolder(dirPath) : null;

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

      await this.createFile(project.id, parentId, fileName, false, content);
    }

    return project;
  },

  /**
   * Import complete workspace ZIP archive.
   */
  async importCompleteWorkspace(file: File, user: UserProfile): Promise<{ importedCount: number }> {
    const zip = await JSZip.loadAsync(file);
    const manifestEntry = zip.file('workspace.json');
    let importedCount = 0;

    if (manifestEntry) {
      const manifestText = await manifestEntry.async('text');
      const manifest: WorkspaceExportManifest = JSON.parse(manifestText);

      // Get existing projects to avoid overwriting or duplicate collisions
      const existingProjects = await this.getProjects(user.id);
      const existingNames = new Set(existingProjects.map(p => p.name.toLowerCase()));

      for (const projMeta of manifest.projects) {
        let uniqueName = projMeta.name;
        if (existingNames.has(uniqueName.toLowerCase())) {
          uniqueName = `${projMeta.name} (Imported ${new Date().toLocaleDateString()})`;
        }
        existingNames.add(uniqueName.toLowerCase());

        const project = await this.createProject(
          uniqueName,
          projMeta.description || 'Restored from CodeCollab workspace backup',
          user
        );

        const folderPrefix = projMeta.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const createdFolders = new Map<string, string>();

        const ensureFolder = async (folderPath: string): Promise<string | null> => {
          const normalized = folderPath.replace(/\/$/, '').trim();
          if (!normalized) return null;
          if (createdFolders.has(normalized)) return createdFolders.get(normalized)!;

          const segments = normalized.split('/');
          let currentPath = '';
          let parentId: string | null = null;

          for (const segment of segments) {
            currentPath = currentPath ? `${currentPath}/${segment}` : segment;
            if (createdFolders.has(currentPath)) {
              parentId = createdFolders.get(currentPath)!;
            } else {
              if (segment === '..' || segment === '.') continue;
              const folderItem = await this.createFile(project.id, parentId, segment, true);
              createdFolders.set(currentPath, folderItem.id);
              parentId = folderItem.id;
            }
          }
          return parentId;
        };

        // Find all files belonging to this project folder in the zip
        for (const [relPath, zipEntry] of Object.entries(zip.files)) {
          if (!relPath.startsWith(`${folderPrefix}/`)) continue;
          if (zipEntry.dir) continue;

          const subPath = relPath.substring(folderPrefix.length + 1);
          if (!subPath || subPath.includes('..')) continue;

          const lastSlash = subPath.lastIndexOf('/');
          const dirPath = lastSlash !== -1 ? subPath.substring(0, lastSlash) : '';
          const fileName = lastSlash !== -1 ? subPath.substring(lastSlash + 1) : subPath;

          const parentId = dirPath ? await ensureFolder(dirPath) : null;
          const ext = fileName.split('.').pop()?.toLowerCase();
          const isBinary = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(ext || '');

          let content = '';
          if (isBinary) {
            const b64 = await zipEntry.async('base64');
            const mime = ext === 'png' ? 'image/png' : ext === 'mp4' ? 'video/mp4' : 'application/octet-stream';
            content = `data:${mime};base64,${b64}`;
          } else {
            content = await zipEntry.async('text');
          }

          await this.createFile(project.id, parentId, fileName, false, content);
        }

        importedCount++;
      }
    } else {
      // Fallback: import as a single project from the ZIP
      await this.importProjectFromZip(file, user);
      importedCount = 1;
    }

    return { importedCount };
  }
};


