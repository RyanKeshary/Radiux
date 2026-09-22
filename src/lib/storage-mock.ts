import { Project, FileItem, ProjectMember, UserProfile, detectLanguage, ChatMessage, ActivityEvent, DirectMessage } from '@/lib/types';

const STORAGE_KEY_PROJECTS = 'codecollab_projects';
const STORAGE_KEY_MEMBERS = 'codecollab_members';
const STORAGE_KEY_FILES = 'codecollab_files';
const STORAGE_KEY_USERS = 'codecollab_users';
const STORAGE_KEY_MESSAGES = 'codecollab_messages';
const STORAGE_KEY_ACTIVITIES = 'codecollab_activities';
const STORAGE_KEY_DIRECT_MESSAGES = 'codecollab_direct_messages';
const STORAGE_KEY_SHORTCUTS = 'codecollab_custom_shortcuts';

export const DEMO_USERS: UserProfile[] = [];

function getStored<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function setStored<T>(key: string, val: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Local storage write failed', e);
  }
}

export function initStorageMock() {
  // Only maintain real user created data - no dummy project or demo user seeding
}


export const StorageMock = {
  getProjects(userId: string): Project[] {
    const projects = getStored<Project[]>(STORAGE_KEY_PROJECTS, []);
    const members = getStored<ProjectMember[]>(STORAGE_KEY_MEMBERS, []);
    
    return projects.filter(p => {
      if (p.owner_id === userId) return true;
      return members.some(m => m.project_id === p.id && m.user_id === userId);
    }).map(p => {
      const isOwner = p.owner_id === userId;
      return {
        ...p,
        role: isOwner ? 'owner' : 'member'
      };
    });
  },

  getProject(projectId: string): Project | null {
    const projects = getStored<Project[]>(STORAGE_KEY_PROJECTS, []);
    return projects.find(p => p.id === projectId) || null;
  },

  createProject(name: string, description: string, owner: UserProfile): Project {
    const projects = getStored<Project[]>(STORAGE_KEY_PROJECTS, []);
    const members = getStored<ProjectMember[]>(STORAGE_KEY_MEMBERS, []);
    const files = getStored<FileItem[]>(STORAGE_KEY_FILES, []);
    const now = new Date().toISOString();
    const id = 'proj-' + Math.random().toString(36).substring(2, 9);

    const newProj: Project = {
      id,
      name,
      description,
      owner_id: owner.id,
      created_at: now,
      updated_at: now,
      role: 'owner',
    };

    const newMember: ProjectMember = {
      id: 'mem-' + Math.random().toString(36).substring(2, 9),
      project_id: id,
      user_id: owner.id,
      role: 'owner',
      created_at: now,
      profile: owner,
    };

    const starterFile: FileItem = {
      id: 'file-' + Math.random().toString(36).substring(2, 9),
      project_id: id,
      parent_id: null,
      name: 'index.js',
      is_folder: false,
      language: 'javascript',
      content: `// Project: ${name}\nconsole.log("Ready to collaborate!");\n`,
      created_at: now,
      updated_at: now,
    };

    setStored(STORAGE_KEY_PROJECTS, [newProj, ...projects]);
    setStored(STORAGE_KEY_MEMBERS, [...members, newMember]);
    setStored(STORAGE_KEY_FILES, [...files, starterFile]);

    return newProj;
  },

  deleteProject(projectId: string): boolean {
    const projects = getStored<Project[]>(STORAGE_KEY_PROJECTS, []);
    setStored(STORAGE_KEY_PROJECTS, projects.filter(p => p.id !== projectId));
    const members = getStored<ProjectMember[]>(STORAGE_KEY_MEMBERS, []);
    setStored(STORAGE_KEY_MEMBERS, members.filter(m => m.project_id !== projectId));
    const files = getStored<FileItem[]>(STORAGE_KEY_FILES, []);
    setStored(STORAGE_KEY_FILES, files.filter(f => f.project_id !== projectId));
    return true;
  },

  getMembers(projectId: string): ProjectMember[] {
    const members = getStored<ProjectMember[]>(STORAGE_KEY_MEMBERS, []);
    return members.filter(m => m.project_id === projectId);
  },

  addMember(projectId: string, user: UserProfile): ProjectMember {
    const members = getStored<ProjectMember[]>(STORAGE_KEY_MEMBERS, []);
    const existing = members.find(m => m.project_id === projectId && m.user_id === user.id);
    if (existing) return existing;

    const newMember: ProjectMember = {
      id: 'mem-' + Math.random().toString(36).substring(2, 9),
      project_id: projectId,
      user_id: user.id,
      role: 'member',
      created_at: new Date().toISOString(),
      profile: user,
    };

    setStored(STORAGE_KEY_MEMBERS, [...members, newMember]);
    return newMember;
  },

  getFiles(projectId: string): FileItem[] {
    const files = getStored<FileItem[]>(STORAGE_KEY_FILES, []);
    return files.filter(f => f.project_id === projectId);
  },

  createFile(
    projectId: string, 
    parentId: string | null, 
    name: string, 
    isFolder: boolean,
    initialContent?: string
  ): FileItem {
    const files = getStored<FileItem[]>(STORAGE_KEY_FILES, []);
    const now = new Date().toISOString();
    const newFile: FileItem = {
      id: (isFolder ? 'folder-' : 'file-') + Math.random().toString(36).substring(2, 9),
      project_id: projectId,
      parent_id: parentId,
      name,
      is_folder: isFolder,
      language: isFolder ? undefined : detectLanguage(name),
      content: isFolder ? undefined : (initialContent !== undefined ? initialContent : `// ${name}\n`),
      created_at: now,
      updated_at: now,
    };

    setStored(STORAGE_KEY_FILES, [...files, newFile]);
    return newFile;
  },

  renameFile(fileId: string, newName: string): boolean {
    const files = getStored<FileItem[]>(STORAGE_KEY_FILES, []);
    const target = files.find(f => f.id === fileId);
    if (!target) return false;

    target.name = newName;
    if (!target.is_folder) {
      target.language = detectLanguage(newName);
    }
    target.updated_at = new Date().toISOString();
    setStored(STORAGE_KEY_FILES, files);
    return true;
  },

  deleteFile(fileId: string): boolean {
    let files = getStored<FileItem[]>(STORAGE_KEY_FILES, []);
    
    // Collect all child IDs recursively if folder
    const toDelete = new Set<string>([fileId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of files) {
        if (f.parent_id && toDelete.has(f.parent_id) && !toDelete.has(f.id)) {
          toDelete.add(f.id);
          added = true;
        }
      }
    }

    files = files.filter(f => !toDelete.has(f.id));
    setStored(STORAGE_KEY_FILES, files);
    return true;
  },

  updateFileContent(fileId: string, content: string): boolean {
    const files = getStored<FileItem[]>(STORAGE_KEY_FILES, []);
    const target = files.find(f => f.id === fileId);
    if (!target) return false;
    target.content = content;
    target.updated_at = new Date().toISOString();
    setStored(STORAGE_KEY_FILES, files);
    return true;
  },

  // Level 4: Messages & Activities Mock Storage
  getMessages(projectId: string): ChatMessage[] {
    const messages = getStored<ChatMessage[]>(STORAGE_KEY_MESSAGES, []);
    return messages
      .filter(m => m.project_id === projectId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  saveMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessage {
    const messages = getStored<ChatMessage[]>(STORAGE_KEY_MESSAGES, []);
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    messages.push(newMessage);
    setStored(STORAGE_KEY_MESSAGES, messages);
    return newMessage;
  },

  getActivities(projectId: string): ActivityEvent[] {
    const activities = getStored<ActivityEvent[]>(STORAGE_KEY_ACTIVITIES, []);
    return activities
      .filter(a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  logActivity(activity: Omit<ActivityEvent, 'id' | 'created_at'>): ActivityEvent {
    const activities = getStored<ActivityEvent[]>(STORAGE_KEY_ACTIVITIES, []);
    const newActivity: ActivityEvent = {
      ...activity,
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    activities.unshift(newActivity);
    // Keep last 200 activities from the beginning
    setStored(STORAGE_KEY_ACTIVITIES, activities.slice(0, 200));
    return newActivity;
  },

  // Level 7: Profiles, Coding Partners & Notifications
  getProfile(userId: string): UserProfile | null {
    const users = getStored<UserProfile[]>(STORAGE_KEY_USERS, []);
    return users.find(u => u.id === userId) || null;
  },

  updateProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
    const users = getStored<UserProfile[]>(STORAGE_KEY_USERS, []);
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      setStored(STORAGE_KEY_USERS, users);
      return users[idx];
    }
    const newProfile: UserProfile = {
      id: userId,
      email: updates.email || 'user@codecollab.io',
      full_name: updates.full_name || 'Developer',
      ...updates,
    };
    users.push(newProfile);
    setStored(STORAGE_KEY_USERS, users);
    return newProfile;
  },

  getCodingPartners(userId: string): any[] {
    const partners = getStored<any[]>('codecollab_coding_partners', []);
    return partners.filter(p => p.requester_id === userId || p.receiver_id === userId);
  },

  saveCodingPartner(partner: any): any {
    const partners = getStored<any[]>('codecollab_coding_partners', []);
    const idx = partners.findIndex(item => item.id === partner.id);
    if (idx !== -1) {
      partners[idx] = { ...partners[idx], ...partner };
    } else {
      partners.push(partner);
    }
    setStored('codecollab_coding_partners', partners);
    return partner;
  },

  updateCodingPartner(id: string, status: string): void {
    const partners = getStored<any[]>('codecollab_coding_partners', []);
    let changed = false;
    partners.forEach(p => {
      if (p.id === id) {
        p.status = status;
        p.updated_at = new Date().toISOString();
        changed = true;
      }
    });
    if (changed) {
      setStored('codecollab_coding_partners', partners);
    }
  },

  removeCodingPartner(id: string): void {
    const partners = getStored<any[]>('codecollab_coding_partners', []);
    setStored('codecollab_coding_partners', partners.filter(p => p.id !== id));
  },

  // Level 8: Direct Developer Messaging & Profile Lookups
  getProfileByUsername(username: string): UserProfile | null {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    const users = getStored<UserProfile[]>(STORAGE_KEY_USERS, []);
    return users.find(u => (u.username?.toLowerCase() === clean) || (u.id === clean)) || null;
  },

  getAllProfiles(): UserProfile[] {
    return getStored<UserProfile[]>(STORAGE_KEY_USERS, []);
  },

  getDirectMessages(user1Id: string, user2Id: string): DirectMessage[] {
    const msgs = getStored<DirectMessage[]>(STORAGE_KEY_DIRECT_MESSAGES, []);
    return msgs.filter(m => 
      (m.sender_id === user1Id && m.receiver_id === user2Id) ||
      (m.sender_id === user2Id && m.receiver_id === user1Id)
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  saveDirectMessage(msg: DirectMessage): DirectMessage {
    const msgs = getStored<DirectMessage[]>(STORAGE_KEY_DIRECT_MESSAGES, []);
    msgs.push(msg);
    setStored(STORAGE_KEY_DIRECT_MESSAGES, msgs);
    return msg;
  },

  markDirectMessagesRead(senderId: string, receiverId: string): void {
    const msgs = getStored<DirectMessage[]>(STORAGE_KEY_DIRECT_MESSAGES, []);
    let changed = false;
    msgs.forEach(m => {
      if (m.sender_id === senderId && m.receiver_id === receiverId && !m.read) {
        m.read = true;
        changed = true;
      }
    });
    if (changed) {
      setStored(STORAGE_KEY_DIRECT_MESSAGES, msgs);
    }
  },

  getCustomShortcuts(): Record<string, string> {
    return getStored<Record<string, string>>(STORAGE_KEY_SHORTCUTS, {});
  },

  saveCustomShortcut(commandId: string, shortcut: string): void {
    const map = getStored<Record<string, string>>(STORAGE_KEY_SHORTCUTS, {});
    map[commandId] = shortcut;
    setStored(STORAGE_KEY_SHORTCUTS, map);
  },

  resetCustomShortcuts(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_SHORTCUTS);
    }
  }
};


