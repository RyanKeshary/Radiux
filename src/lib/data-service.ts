import { supabase, isSupabaseConfigured } from './supabase/client';
import { StorageMock } from './storage-mock';
import { Project, ProjectMember, FileItem, UserProfile, detectLanguage } from './types';

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

  async createFile(projectId: string, parentId: string | null, name: string, isFolder: boolean): Promise<FileItem> {
    const language = isFolder ? undefined : detectLanguage(name);
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('files')
        .insert({
          project_id: projectId,
          parent_id: parentId,
          name,
          is_folder: isFolder,
          language,
          content: isFolder ? '' : `// ${name}\n`,
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
    return StorageMock.createFile(projectId, parentId, name, isFolder);
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
  }
};
