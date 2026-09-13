import { supabase, isSupabaseConfigured } from './supabase/client';
import { StorageMock, DEMO_USERS } from './storage-mock';
import { Project, ProjectMember, FileItem, UserProfile } from './types';

export const DataService = {
  // Check backend mode
  isSupabaseActive(): boolean {
    return isSupabaseConfigured;
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
    return data || [];
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

    // Add owner as member
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
      content: `// Project: ${name}\nconsole.log("Welcome to CodeCollab!");\n`
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
