import { Project, FileItem, ProjectMember, UserProfile, detectLanguage, ChatMessage, ActivityEvent } from '@/lib/types';

const STORAGE_KEY_PROJECTS = 'codecollab_projects';
const STORAGE_KEY_MEMBERS = 'codecollab_members';
const STORAGE_KEY_FILES = 'codecollab_files';
const STORAGE_KEY_USERS = 'codecollab_users';
const STORAGE_KEY_MESSAGES = 'codecollab_messages';
const STORAGE_KEY_ACTIVITIES = 'codecollab_activities';

export const DEMO_USERS: UserProfile[] = [
  {
    id: 'user-alice-1111',
    email: 'alice@codecollab.io',
    full_name: 'Alice Dev',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
  },
  {
    id: 'user-bob-2222',
    email: 'bob@codecollab.io',
    full_name: 'Bob Coder',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
  },
  {
    id: 'user-charlie-3333',
    email: 'charlie@codecollab.io',
    full_name: 'Charlie Eng',
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie',
  }
];

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
  if (typeof window === 'undefined') return;
  const existingProjects = getStored<Project[]>(STORAGE_KEY_PROJECTS, []);
  if (existingProjects.length === 0) {
    // Seed initial project
    const pId = 'proj-welcome-demo';
    const now = new Date().toISOString();
    const demoProject: Project = {
      id: pId,
      name: 'Welcome to CodeCollab',
      description: 'Collaborative starter workspace with JavaScript & Python files',
      owner_id: DEMO_USERS[0].id,
      created_at: now,
      updated_at: now,
      role: 'owner',
    };
    setStored(STORAGE_KEY_PROJECTS, [demoProject]);

    // Members
    const members: ProjectMember[] = [
      {
        id: 'mem-1',
        project_id: pId,
        user_id: DEMO_USERS[0].id,
        role: 'owner',
        created_at: now,
        profile: DEMO_USERS[0],
      },
      {
        id: 'mem-2',
        project_id: pId,
        user_id: DEMO_USERS[1].id,
        role: 'member',
        created_at: now,
        profile: DEMO_USERS[1],
      }
    ];
    setStored(STORAGE_KEY_MEMBERS, members);

    // Initial files
    const folderSrcId = 'folder-src';
    const initialFiles: FileItem[] = [
      {
        id: folderSrcId,
        project_id: pId,
        parent_id: null,
        name: 'src',
        is_folder: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'file-index-js',
        project_id: pId,
        parent_id: folderSrcId,
        name: 'index.js',
        is_folder: false,
        language: 'javascript',
        content: `// Welcome to CodeCollab!
// Multiple users can edit this code simultaneously in real-time.

function greet(collaborator) {
  console.log(\`Hello \${collaborator}! Real-time coding active.\`);
}

greet("Alice & Bob");
`,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'file-main-py',
        project_id: pId,
        parent_id: folderSrcId,
        name: 'main.py',
        is_folder: false,
        language: 'python',
        content: `# CodeCollab Python Workspace
def run_collaboration():
    peers = ["Alice", "Bob", "Charlie"]
    for peer in peers:
        print(f"Connecting peer: {peer} to shared session...")

if __name__ == "__main__":
    run_collaboration()
`,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'file-readme',
        project_id: pId,
        parent_id: null,
        name: 'README.md',
        is_folder: false,
        language: 'plaintext',
        content: `# Welcome to CodeCollab 🚀

CodeCollab allows multiple developers to work on the same coding project simultaneously from their browsers.

- Real-time document sync powered by Yjs & WebSockets.
- Professional code editor powered by Monaco Editor.
- File explorer with multi-level nested folders.
- Automatic online persistence.
`,
        created_at: now,
        updated_at: now,
      }
    ];
    setStored(STORAGE_KEY_FILES, initialFiles);
  }
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
    const users = getStored<UserProfile[]>(STORAGE_KEY_USERS, DEMO_USERS);
    return users.find(u => u.id === userId) || null;
  },

  updateProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
    const users = getStored<UserProfile[]>(STORAGE_KEY_USERS, DEMO_USERS);
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
    partners.push(partner);
    setStored('codecollab_coding_partners', partners);
    return partner;
  },

  updateCodingPartner(id: string, status: string): void {
    const partners = getStored<any[]>('codecollab_coding_partners', []);
    const p = partners.find(item => item.id === id);
    if (p) {
      p.status = status;
      p.updated_at = new Date().toISOString();
      setStored('codecollab_coding_partners', partners);
    }
  },

  removeCodingPartner(id: string): void {
    const partners = getStored<any[]>('codecollab_coding_partners', []);
    setStored('codecollab_coding_partners', partners.filter(p => p.id !== id));
  },

  getNotifications(userId: string): any[] {
    const list = getStored<any[]>('codecollab_notifications', []);
    return list.filter(n => n.user_id === userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  saveNotification(notification: any): any {
    const list = getStored<any[]>('codecollab_notifications', []);
    list.unshift(notification);
    setStored('codecollab_notifications', list.slice(0, 50));
    return notification;
  },

  markNotificationRead(id: string): void {
    const list = getStored<any[]>('codecollab_notifications', []);
    const target = list.find(n => n.id === id);
    if (target) {
      target.read = true;
      setStored('codecollab_notifications', list);
    }
  },

  markAllNotificationsRead(userId: string): void {
    const list = getStored<any[]>('codecollab_notifications', []);
    list.forEach(n => {
      if (n.user_id === userId) n.read = true;
    });
    setStored('codecollab_notifications', list);
  }
};


