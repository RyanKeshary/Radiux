import { supabase, isSupabaseConfigured } from './supabase/client';
import { StorageMock } from './storage-mock';
import { Project, ProjectMember, FileItem, UserProfile } from './types';

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
    if (!isSupabaseConfigured || !supabase) {
      const p = StorageMock.getProject(projectId);
      if (!p) return { authorized: false };
      return { authorized: true, role: p.owner_id === userId ? 'owner' : 'member' };
    }

    // Check if owner
    const { data: proj } = await supabase
      .from('projects')
      .select('id, owner_id')
      .eq('id', projectId)
      .single();

    if (proj && proj.owner_id === userId) {
      return { authorized: true, role: 'owner' };
    }

    // Check if member
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
  },

  // Projects
  async getProjects(userId: string): Promise<Project[]> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.getProjects(userId);
    }
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase getProjects error, falling back to local storage:', error.message);
      return StorageMock.getProjects(userId);
    }
    return (data || []).map((p: any) => ({
      ...p,
      role: p.owner_id === userId ? 'owner' : 'member'
    }));
  },

  async getProject(projectId: string): Promise<Project | null> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.getProject(projectId);
    }
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.warn('Supabase getProject error:', error.message);
      return StorageMock.getProject(projectId);
    }
    return data;
  },

  async createProject(name: string, description: string, user: UserProfile): Promise<Project> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.createProject(name, description, user);
    }
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        owner_id: user.id
      })
      .select()
      .single();

    if (error) {
      console.warn('Supabase createProject error:', error.message);
      return StorageMock.createProject(name, description, user);
    }

    // Add owner as member in project_members
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
  },

  // Members
  async getMembers(projectId: string): Promise<ProjectMember[]> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.getMembers(projectId);
    }
    const { data, error } = await supabase
      .from('project_members')
      .select('*, profile:profiles(*)')
      .eq('project_id', projectId);

    if (error) {
      console.warn('Supabase getMembers error:', error.message);
      return StorageMock.getMembers(projectId);
    }
    return data || [];
  },

  async addMember(projectId: string, user: UserProfile): Promise<ProjectMember> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.addMember(projectId, user);
    }
    const { data, error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: user.id,
        role: 'member'
      })
      .select('*, profile:profiles(*)')
      .single();

    if (error) {
      console.warn('Supabase addMember error:', error.message);
      return StorageMock.addMember(projectId, user);
    }
    return data;
  },

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return true;
    }
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    return !error;
  },

  // Files
  async getFiles(projectId: string): Promise<FileItem[]> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.getFiles(projectId);
    }
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('is_folder', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase getFiles error:', error.message);
      return StorageMock.getFiles(projectId);
    }
    return data || [];
  },

  async createFile(projectId: string, parentId: string | null, name: string, isFolder: boolean): Promise<FileItem> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.createFile(projectId, parentId, name, isFolder);
    }
    const { data, error } = await supabase
      .from('files')
      .insert({
        project_id: projectId,
        parent_id: parentId,
        name,
        is_folder: isFolder,
        content: isFolder ? '' : `// ${name}\n`,
      })
      .select()
      .single();

    if (error) {
      console.warn('Supabase createFile error:', error.message);
      return StorageMock.createFile(projectId, parentId, name, isFolder);
    }
    return data;
  },

  async renameFile(fileId: string, newName: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.renameFile(fileId, newName);
    }
    const { error } = await supabase
      .from('files')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', fileId);

    if (error) {
      console.warn('Supabase renameFile error:', error.message);
      return StorageMock.renameFile(fileId, newName);
    }
    return true;
  },

  async deleteFile(fileId: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.deleteFile(fileId);
    }
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (error) {
      console.warn('Supabase deleteFile error:', error.message);
      return StorageMock.deleteFile(fileId);
    }
    return true;
  },

  async updateFileContent(fileId: string, content: string): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) {
      return StorageMock.updateFileContent(fileId, content);
    }
    const { error } = await supabase
      .from('files')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', fileId);

    if (error) {
      console.warn('Supabase updateFileContent error:', error.message);
      return StorageMock.updateFileContent(fileId, content);
    }
    return true;
  }
};
