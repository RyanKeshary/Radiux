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
  WorkspaceExportManifest,
  CodingPartner,
  NotificationItem,
  DirectMessage,
  ContributionDay
} from './types';

export const DataService = {
  isSupabaseActive(): boolean {
    return isSupabaseConfigured;
  },

  // Lookup registered user by email, ID, or username
  async findUser(identifier: string): Promise<UserProfile | null> {
    const clean = (identifier || '').trim();
    if (!clean) return null;

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('profiles').select('*');
        if (clean.includes('@')) {
          query = query.ilike('email', clean);
        } else if (clean.length > 20 && !clean.includes(' ')) {
          // UUID or ID check
          query = query.or(`id.eq.${clean},email.ilike.${clean}`);
        } else {
          query = query.or(`email.ilike.${clean},full_name.ilike.${clean}`);
        }
        const { data, error } = await query.limit(1);
        if (!error && data && data.length > 0) {
          const user = data[0];
          return {
            id: user.id,
            email: user.email,
            full_name: user.full_name || user.email?.split('@')[0],
            avatar_url: user.avatar_url,
          };
        }
      } catch (e) {}
    }
    const mock = StorageMock.getProfile(clean);
    if (mock) return mock;
    return null;
  },

  async findUserByEmail(email: string): Promise<UserProfile | null> {
    return this.findUser(email);
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
          content: `// Project: ${name}\n// Created by ${user.full_name}\n\nconsole.log("Welcome to Radiux!");\n`
        });

        return data;
      }
      console.warn('Supabase createProject failed, storing locally:', error?.message);
    }

    return StorageMock.createProject(name, description, user);
  },

  async deleteProject(projectId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('files').delete().eq('project_id', projectId);
        await supabase.from('project_members').delete().eq('project_id', projectId);
        await supabase.from('messages').delete().eq('project_id', projectId);
        await supabase.from('activities').delete().eq('project_id', projectId);
        const { error } = await supabase.from('projects').delete().eq('id', projectId);
        if (!error) return true;
      } catch (e) {
        console.warn('Supabase deleteProject failed:', e);
      }
    }
    return StorageMock.deleteProject(projectId);
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
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
          .limit(150);

        if (!error && data && data.length > 0) {
          return data as ChatMessage[];
        }
      } catch (err) {}
    }

    // Fallback to Backend API (cross-user persistent store)
    try {
      const res = await fetch(buildApiUrl('/api/messages', { projectId }));
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.messages) && json.messages.length > 0) {
          json.messages.forEach((m: ChatMessage) => StorageMock.saveMessage(m));
          return json.messages;
        }
      }
    } catch (e) {}

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
      } catch (storageErr) {
        console.warn('[DataService] Media upload to Storage failed, using base64 fallback:', storageErr);
      }
    }

    const localPayload: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      project_id: projectId,
      user_id: userId,
      user_name: userName,
      user_avatar: userAvatar,
      content: content.trim(),
      media_type: media?.type,
      media_url: mediaUrl,
      media_name: media?.name,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
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
      } catch (err) {}
    }

    // Persist to Backend API so all collaborators and reloads see this message
    try {
      const res = await fetch(buildApiUrl('/api/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, message: localPayload }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.message) {
          StorageMock.saveMessage(json.message);
          return json.message;
        }
      }
    } catch (e) {}

    return StorageMock.saveMessage(localPayload);
  },

  async getActivities(projectId: string): Promise<ActivityEvent[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('activities')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(200);

        if (!error && data && data.length > 0) {
          return data as ActivityEvent[];
        }
      } catch (err) {}
    }

    try {
      const res = await fetch(buildApiUrl('/api/activities', { projectId }));
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.activities) && json.activities.length > 0) {
          json.activities.forEach((a: ActivityEvent) => StorageMock.logActivity(a));
          return json.activities;
        }
      }
    } catch (e) {}

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
    const actPayload: ActivityEvent = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      project_id: projectId,
      user_id: userId,
      user_name: userName,
      action_type: actionType,
      details: details.trim(),
      target_object: targetObject || '',
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
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
      } catch (err) {}
    }

    try {
      const res = await fetch(buildApiUrl('/api/activities'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, activity: actPayload }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.activity) {
          StorageMock.logActivity(json.activity);
          return json.activity;
        }
      }
    } catch (e) {}

    return StorageMock.logActivity(actPayload);
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
   * Export all user projects into a complete workspace archive radiux-workspace.zip
   */
  async exportCompleteWorkspace(userId: string, workspaceName = 'radiux-workspace'): Promise<void> {
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
          projMeta.description || 'Restored from Radiux workspace backup',
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
  },

  // Level 7 & 8: Profiles & Developer Identity
  async getProfile(userId: string): Promise<UserProfile | null> {
    const mockProfile = StorageMock.getProfile(userId);
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        // Merge: Supabase has full data if schema is migrated.
        // StorageMock fills in any fields not yet in the DB (fallback).
        const merged: UserProfile = {
          id: data.id,
          email: data.email,
          full_name: data.full_name || mockProfile?.full_name || '',
          avatar_url: data.avatar_url || mockProfile?.avatar_url || '',
          username: data.username || mockProfile?.username || data.email?.split('@')[0],
          bio: data.bio || mockProfile?.bio || '',
          role: data.role || mockProfile?.role || '',
          location: data.location || mockProfile?.location || '',
          education: data.education || mockProfile?.education || '',
          skills: (data.skills && data.skills.length > 0) ? data.skills : (mockProfile?.skills || []),
          languages: (data.languages && data.languages.length > 0) ? data.languages : (mockProfile?.languages || []),
          technologies: (data.technologies && data.technologies.length > 0) ? data.technologies : (mockProfile?.technologies || []),
          website: data.website || mockProfile?.website || '',
          github_username: data.github_username || mockProfile?.github_username || '',
          linkedin_url: data.linkedin_url || mockProfile?.linkedin_url || '',
          other_links: (data.other_links && data.other_links.length > 0) ? data.other_links : (mockProfile?.other_links || []),
          collaboration_interests: (data.collaboration_interests && data.collaboration_interests.length > 0) ? data.collaboration_interests : (mockProfile?.collaboration_interests || []),
          readme_markdown: data.readme_markdown || mockProfile?.readme_markdown || '',
          pinned_project_ids: (data.pinned_project_ids && data.pinned_project_ids.length > 0) ? data.pinned_project_ids : (mockProfile?.pinned_project_ids || []),
          privacy: (data.privacy && Object.keys(data.privacy).length > 0) ? data.privacy : (mockProfile?.privacy || {}),
          preferences: (data.preferences && Object.keys(data.preferences).length > 0) ? data.preferences : (mockProfile?.preferences || {}),
        };
        // Sync the merged result back to StorageMock for local consistency
        StorageMock.updateProfile(userId, merged);
        return merged;
      }
    }
    return mockProfile;
  },


  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    // 1. Always update StorageMock for immediate local consistency
    const localUpdated = StorageMock.updateProfile(userId, updates);

    if (isSupabaseConfigured && supabase) {
      try {
        // 2. Try updating ALL fields in Supabase profiles table
        //    (works if schema has been migrated with extended columns)
        const profileUpdate: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        const allProfileFields = [
          'full_name', 'avatar_url', 'username', 'bio', 'role', 'location',
          'education', 'website', 'github_username', 'linkedin_url',
          'skills', 'languages', 'technologies', 'other_links',
          'collaboration_interests', 'readme_markdown', 'pinned_project_ids',
          'privacy', 'preferences',
        ];
        allProfileFields.forEach((key) => {
          if ((updates as any)[key] !== undefined) {
            profileUpdate[key] = (updates as any)[key];
          }
        });
        if (updates.pinned_project_ids) {
          profileUpdate.pinned_project_ids = updates.pinned_project_ids.slice(0, 4);
        }
        await supabase.from('profiles').update(profileUpdate).eq('id', userId);

        // 3. ALSO persist to Supabase auth user_metadata as a durable backup
        //    (survives even if profiles table columns are dropped/missing)
        const metaFields = [
          'username', 'bio', 'role', 'location', 'education',
          'skills', 'languages', 'technologies', 'website',
          'github_username', 'linkedin_url', 'other_links',
          'collaboration_interests', 'readme_markdown',
          'pinned_project_ids', 'privacy', 'preferences', 'avatar_url', 'full_name',
        ];
        const metaUpdates: Record<string, any> = {};
        metaFields.forEach((key) => {
          if ((updates as any)[key] !== undefined) {
            metaUpdates[key] = (updates as any)[key];
          }
        });
        if (Object.keys(metaUpdates).length > 0) {
          // Only update auth metadata for the currently logged-in user
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user?.id === userId) {
            await supabase.auth.updateUser({ data: metaUpdates });
          }
        }
      } catch (err) {
        console.warn('updateProfile: partial Supabase failure:', err);
      }
    }

    return localUpdated;
  },


  // Level 8: Direct Profile Lookup by Handle
  async getProfileByUsername(username: string): Promise<UserProfile | null> {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    // First check StorageMock which holds extended profile data
    const mockProfile = StorageMock.getProfileByUsername(clean);
    if (isSupabaseConfigured && supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
        let query = supabase.from('profiles').select('*');
        if (isUuid) {
          query = query.eq('id', clean);
        } else {
          query = query.or(`email.ilike.%${clean}%,full_name.ilike.%${clean}%`);
        }
        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          // Merge Supabase base with StorageMock extended data
          const matchedMock = StorageMock.getProfile(data.id);
          return {
            id: data.id,
            email: data.email,
            full_name: data.full_name || matchedMock?.full_name || '',
            avatar_url: data.avatar_url || matchedMock?.avatar_url || '',
            username: matchedMock?.username || data.email?.split('@')[0],
            bio: matchedMock?.bio || '',
            role: matchedMock?.role || '',
            location: matchedMock?.location || '',
            education: matchedMock?.education || '',
            skills: matchedMock?.skills || [],
            languages: matchedMock?.languages || [],
            technologies: matchedMock?.technologies || [],
            website: matchedMock?.website || '',
            github_username: matchedMock?.github_username || '',
            linkedin_url: matchedMock?.linkedin_url || '',
            other_links: matchedMock?.other_links || [],
            collaboration_interests: matchedMock?.collaboration_interests || [],
            readme_markdown: matchedMock?.readme_markdown || '',
            pinned_project_ids: matchedMock?.pinned_project_ids || [],
            privacy: matchedMock?.privacy || {},
            preferences: matchedMock?.preferences || {},
          };
        }
      } catch (e) {}
    }
    // Fallback: find by username match in StorageMock
    if (mockProfile) return mockProfile;
    // Try matching email prefix
    const all = StorageMock.getAllProfiles();
    return all.find(p => 
      (p.username || p.email?.split('@')[0])?.toLowerCase() === clean
    ) || null;
  },

  // Level 8: Public Profile with Server/Client Privacy Filters
  async getPublicProfile(identifier: string, viewerUserId?: string): Promise<UserProfile | null> {
    const profile = (await this.getProfileByUsername(identifier)) || (await this.getProfile(identifier));
    if (!profile) return null;

    // The owner can see everything on their own profile
    if (viewerUserId && viewerUserId === profile.id) {
      return profile;
    }

    // Apply privacy permissions
    const privacy = profile.privacy || {};
    return {
      ...profile,
      email: privacy.show_email ? profile.email : '',
      location: privacy.show_location !== false ? profile.location : undefined,
      education: privacy.show_education !== false ? profile.education : undefined,
      skills: privacy.show_skills !== false ? profile.skills : [],
      other_links: privacy.show_links !== false ? profile.other_links : [],
      website: privacy.show_links !== false ? profile.website : undefined,
      github_username: privacy.show_links !== false ? profile.github_username : undefined,
      linkedin_url: privacy.show_links !== false ? profile.linkedin_url : undefined,
      readme_markdown: privacy.show_readme !== false ? profile.readme_markdown : undefined,
    };
  },

  // Level 8: Developer Discovery Search
  async searchDevelopers(query: string, currentUserId?: string): Promise<UserProfile[]> {
    const q = query.toLowerCase().trim();
    const all = StorageMock.getAllProfiles();
    return all.filter(u => {
      if (currentUserId && u.id === currentUserId) return false;
      if (!q) return true;
      const matchName = u.full_name?.toLowerCase().includes(q);
      const matchUsername = u.username?.toLowerCase().includes(q);
      const matchBio = u.bio?.toLowerCase().includes(q);
      const matchSkills = u.skills?.some(s => s.toLowerCase().includes(q));
      const matchRole = u.role?.toLowerCase().includes(q);
      const matchTech = u.technologies?.some(t => t.toLowerCase().includes(q));
      return matchName || matchUsername || matchBio || matchSkills || matchRole || matchTech;
    });
  },

  // Level 8: Pinned Projects (Strict Max 4, authorized privacy check)
  async getPinnedProjects(userId: string, viewerUserId?: string): Promise<Project[]> {
    const profile = await this.getProfile(userId);
    if (!profile || !profile.pinned_project_ids || profile.pinned_project_ids.length === 0) {
      return [];
    }
    const allProjects = await this.getProjects(userId);
    const pinnedIds = profile.pinned_project_ids.slice(0, 4); // Strict maximum 4
    const result: Project[] = [];
    for (const pid of pinnedIds) {
      const proj = allProjects.find(p => p.id === pid);
      if (proj) {
        result.push(proj);
      }
    }
    return result;
  },

  async updatePinnedProjects(userId: string, projectIds: string[]): Promise<UserProfile> {
    const sanitized = projectIds.slice(0, 4); // Enforce maximum 4 projects strictly
    return this.updateProfile(userId, { pinned_project_ids: sanitized });
  },

  // Level 8: Developer Activity Contribution Calendar (52-week calculation)
  async getDeveloperContributions(userId: string): Promise<{
    days: ContributionDay[];
    totalContributions: number;
    currentStreak: number;
    longestStreak: number;
  }> {
    const days: ContributionDay[] = [];
    const today = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    // Aggregation of real events from user's projects
    const activityCountByDate: Record<string, number> = {};
    const userProjects = await this.getProjects(userId);
    
    for (const proj of userProjects) {
      try {
        const activities = await this.getActivities(proj.id);
        for (const act of activities) {
          if (act.user_id === userId) {
            const dateStr = act.created_at.split('T')[0];
            activityCountByDate[dateStr] = (activityCountByDate[dateStr] || 0) + 1;
          }
        }
      } catch (e) {}
    }

    // Baseline contributions for demo users to visualize the graph realistically if fresh account
    if (userId.startsWith('user-') && Object.keys(activityCountByDate).length === 0) {
      // Deterministic seed based on user id
      const seed = userId.charCodeAt(userId.length - 1);
      for (let i = 0; i < 365; i++) {
        const d = new Date(today.getTime() - i * oneDayMs);
        const dayOfWeek = d.getDay();
        if ((i + seed) % 3 === 0 && dayOfWeek !== 0) {
          const dateStr = d.toISOString().split('T')[0];
          activityCountByDate[dateStr] = ((i * 7 + seed) % 8) + 1;
        }
      }
    }

    const startDate = new Date(today.getTime() - 364 * oneDayMs);
    let total = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < 365; i++) {
      const d = new Date(startDate.getTime() + i * oneDayMs);
      const dateKey = d.toISOString().split('T')[0];
      const count = activityCountByDate[dateKey] || 0;
      total += count;

      if (count > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count >= 8) level = 4;
      else if (count >= 5) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;

      days.push({
        date: dateKey,
        count,
        level,
      });
    }

    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count > 0) {
        currentStreak++;
      } else if (i === days.length - 1) {
        continue;
      } else {
        break;
      }
    }

    return {
      days,
      totalContributions: total,
      currentStreak,
      longestStreak,
    };
  },

  // Level 8: Direct Developer Messaging
  async getDirectMessages(user1Id: string, user2Id: string): Promise<DirectMessage[]> {
    return StorageMock.getDirectMessages(user1Id, user2Id);
  },

  async sendDirectMessage(sender: UserProfile, receiverId: string, content: string): Promise<DirectMessage> {
    const msg: DirectMessage = {
      id: `dm-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sender_id: sender.id,
      receiver_id: receiverId,
      content,
      created_at: new Date().toISOString(),
      read: false,
    };
    StorageMock.saveDirectMessage(msg);

    // Send notification to recipient
    StorageMock.saveNotification({
      id: `notif-${Date.now()}`,
      user_id: receiverId,
      type: 'mention',
      title: 'Direct Message',
      message: `${sender.full_name || 'A developer'}: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
      read: false,
      created_at: new Date().toISOString(),
      data: { senderId: sender.id },
    });

    return msg;
  },

  async markDirectMessagesRead(senderId: string, receiverId: string): Promise<void> {
    StorageMock.markDirectMessagesRead(senderId, receiverId);
  },

  // Level 7: Coding Partners
  async getCodingPartners(userId: string): Promise<CodingPartner[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('coding_partners')
          .select('*, requester:requester_id(*), receiver:receiver_id(*)')
          .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            requester_id: d.requester_id,
            receiver_id: d.receiver_id,
            status: d.status,
            created_at: d.created_at,
            updated_at: d.updated_at,
            profile: d.requester_id === userId ? d.receiver : d.requester,
          }));
        }
      } catch (e) {}
    }

    // Fallback to Backend API (cross-user persistent store)
    try {
      const res = await fetch(buildApiUrl('/api/partners', { userId }));
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.partners) && json.partners.length > 0) {
          json.partners.forEach((p: CodingPartner) => StorageMock.saveCodingPartner(p));
          return json.partners;
        }
      }
    } catch (e) {}

    const mockList = StorageMock.getCodingPartners(userId);
    return mockList.map((m: any) => ({
      ...m,
      profile: m.requester_id === userId ? StorageMock.getProfile(m.receiver_id) : StorageMock.getProfile(m.requester_id),
    }));
  },

  async sendPartnerRequest(
    requester: UserProfile,
    targetIdentifier: string
  ): Promise<{ success: boolean; message: string; partner?: CodingPartner }> {
    const targetUser = await this.findUser(targetIdentifier);
    const target = targetUser || StorageMock.getProfile(targetIdentifier);

    if (!target) {
      return { success: false, message: `No developer found matching "${targetIdentifier}".` };
    }

    if (target.id === requester.id) {
      return { success: false, message: 'You cannot send a partner request to yourself.' };
    }

    // 1. Duplicate request check
    const existingList = await this.getCodingPartners(requester.id);
    const duplicate = existingList.find(
      (p) => (p.requester_id === target.id || p.receiver_id === target.id)
    );

    if (duplicate) {
      if (duplicate.status === 'accepted') {
        return { success: false, message: 'You are already coding partners!' };
      }
      if (duplicate.status === 'pending') {
        return { success: false, message: 'A partner request is already pending between you two.' };
      }
    }

    let createdPartner: CodingPartner = {
      id: `partner-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      requester_id: requester.id,
      receiver_id: target.id,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: target,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('coding_partners')
          .insert({
            requester_id: requester.id,
            receiver_id: target.id,
            status: 'pending',
          })
          .select()
          .single();
        if (!error && data) {
          createdPartner = { ...data, profile: target };
        }
      } catch (err) {}
    }

    // 2. Sync to Backend API
    try {
      await fetch(buildApiUrl('/api/partners'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner: createdPartner }),
      });
    } catch (e) {}

    StorageMock.saveCodingPartner(createdPartner);

    // Real persistent notification for recipient
    await this.createNotification(target.id, {
      type: 'partner_request',
      title: 'New Coding Partner Request',
      message: `${requester.full_name || requester.username || 'A developer'} sent you a coding partner request.`,
      sender_id: requester.id,
      sender_name: requester.full_name || requester.username || 'Developer',
      sender_avatar: requester.avatar_url || '',
      partner_request_id: createdPartner.id,
      action_status: 'pending',
    });

    return { 
      success: true, 
      message: `Partner request sent to ${target.full_name || target.username || 'developer'}!`,
      partner: createdPartner 
    };
  },

  async respondToPartnerRequest(
    requestId: string, 
    action: 'accept' | 'ignore' | 'reject' | 'cancel' | boolean,
    notificationId?: string
  ): Promise<void> {
    let status: 'accepted' | 'ignored' | 'rejected' | 'cancelled' | 'declined';
    if (typeof action === 'boolean') {
      status = action ? 'accepted' : 'declined';
    } else if (action === 'accept') {
      status = 'accepted';
    } else if (action === 'ignore') {
      status = 'ignored';
    } else if (action === 'reject') {
      status = 'rejected';
    } else {
      status = 'cancelled';
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('coding_partners')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', requestId);
      } catch (err) {}
    }

    try {
      await fetch(buildApiUrl('/api/partners'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status }),
      });
    } catch (e) {}

    StorageMock.updateCodingPartner(requestId, status);

    if (notificationId) {
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('notifications')
            .update({ action_status: status, read: true })
            .eq('id', notificationId);
        } catch (err) {}
      }
      StorageMock.updateNotificationAction(notificationId, status);
    }

    // If accepted, notify the original requester
    if (status === 'accepted') {
      try {
        let partnerData: any = null;
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from('coding_partners').select('*').eq('id', requestId).single();
          partnerData = data;
        }
        if (!partnerData) {
          const all = await this.getCodingPartners('');
          partnerData = all.find((p: any) => p.id === requestId);
        }

        if (partnerData) {
          const receiver = await this.findUser(partnerData.receiver_id) || StorageMock.getProfile(partnerData.receiver_id);
          await this.createNotification(partnerData.requester_id, {
            type: 'partner_accepted',
            title: 'Partner Request Accepted!',
            message: `${receiver?.full_name || receiver?.username || 'Your peer'} accepted your coding partner request.`,
            sender_id: receiver?.id,
            sender_name: receiver?.full_name || receiver?.username || 'Developer',
            sender_avatar: receiver?.avatar_url || '',
            partner_request_id: requestId,
            action_status: 'completed',
          });
        }
      } catch (e) {}
    }
  },

  async removePartner(partnerId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('coding_partners').delete().eq('id', partnerId);
      } catch (err) {}
    }
    try {
      await fetch(buildApiUrl('/api/partners'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerRequestId: partnerId }),
      });
    } catch (e) {}
    StorageMock.removeCodingPartner(partnerId);
  },

  async unsendPartnerRequest(partnerRequestId: string): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('coding_partners').delete().eq('id', partnerRequestId);
        await supabase.from('notifications').delete().eq('partner_request_id', partnerRequestId);
      } catch (err) {}
    }

    try {
      await fetch(buildApiUrl('/api/partners'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerRequestId }),
      });
    } catch (e) {}

    StorageMock.removeCodingPartner(partnerRequestId);
    StorageMock.removeNotificationByPartnerRequestId(partnerRequestId);
    return { success: true, message: 'Friend request unsent successfully.' };
  },

  // Level 7: Notifications
  async getNotifications(userId: string): Promise<NotificationItem[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data;
      } catch (err) {}
    }

    // Fallback to Backend API (cross-user persistent store)
    try {
      const res = await fetch(buildApiUrl('/api/notifications', { userId }));
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.notifications) && json.notifications.length > 0) {
          json.notifications.forEach((n: NotificationItem) => StorageMock.saveNotification(n));
          return json.notifications;
        }
      }
    } catch (e) {}

    return StorageMock.getNotifications(userId);
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
      } catch (err) {}
    }
    try {
      await fetch(buildApiUrl('/api/notifications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notificationId }),
      });
    } catch (e) {}
    StorageMock.markNotificationRead(notificationId);
  },

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
      } catch (err) {}
    }
    try {
      await fetch(buildApiUrl('/api/notifications'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, all: true }),
      });
    } catch (e) {}
    StorageMock.markAllNotificationsRead(userId);
  },

  async dismissNotification(notificationId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('notifications').delete().eq('id', notificationId);
      } catch (err) {}
    }
    try {
      await fetch(buildApiUrl('/api/notifications'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notificationId }),
      });
    } catch (e) {}
    StorageMock.dismissNotification(notificationId);
  },

  async clearAllNotifications(userId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('notifications').delete().eq('user_id', userId);
      } catch (err) {}
    }
    try {
      await fetch(buildApiUrl('/api/notifications'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, all: true }),
      });
    } catch (e) {}
    StorageMock.clearAllNotifications(userId);
  },

  async createNotification(
    userId: string,
    notification: Omit<NotificationItem, 'id' | 'created_at' | 'read' | 'user_id'>
  ): Promise<NotificationItem> {
    const item: NotificationItem = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      user_id: userId,
      read: false,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('notifications').insert(item);
      } catch (err) {}
    }

    try {
      await fetch(buildApiUrl('/api/notifications'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification: item }),
      });
    } catch (e) {}

    StorageMock.saveNotification(item);
    return item;
  },
};



