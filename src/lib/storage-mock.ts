import { Project, FileItem, ProjectMember, UserProfile, detectLanguage, ChatMessage, ActivityEvent, DirectMessage } from '@/lib/types';

const STORAGE_KEY_PROJECTS = 'codecollab_projects';
const STORAGE_KEY_MEMBERS = 'codecollab_members';
const STORAGE_KEY_FILES = 'codecollab_files';
const STORAGE_KEY_USERS = 'codecollab_users';
const STORAGE_KEY_MESSAGES = 'codecollab_messages';
const STORAGE_KEY_ACTIVITIES = 'codecollab_activities';
const STORAGE_KEY_DIRECT_MESSAGES = 'codecollab_direct_messages';
const STORAGE_KEY_SHORTCUTS = 'codecollab_custom_shortcuts';

export const DEMO_USERS: UserProfile[] = [
  {
    id: 'user-alice-1111',
    email: 'alice@codecollab.io',
    full_name: 'Alice Dev',
    username: 'alice',
    role: 'Lead Cloud Architect',
    location: 'San Francisco, CA',
    education: 'M.S. Computer Science, Stanford',
    bio: 'Building high-concurrency real-time systems, collaborative developer tools, and distributed cloud runtimes.',
    skills: ['TypeScript', 'Next.js', 'Go', 'Rust', 'Docker', 'WebSockets', 'Yjs'],
    languages: ['TypeScript', 'Go', 'Python'],
    technologies: ['React', 'TailwindCSS', 'Node.js', 'PostgreSQL', 'Redis'],
    website: 'https://alicedev.io',
    github_username: 'alicedev',
    linkedin_url: 'https://linkedin.com/in/alicedev',
    collaboration_interests: ['Cloud IDEs', 'Real-time CRDTs', 'Developer Experience'],
    readme_markdown: `# Hey, I'm Alice 👋\n\nI lead cloud infrastructure and real-time collaborative protocols at CodeCollab.\n\n## 🛠️ What I'm building\n- Distributed WebAssembly execution sandboxes\n- Low-latency operational transformation & Yjs state sync\n- Multi-region peer-to-peer developer voice relays\n\n## 🚀 Tech Stack\n\`TypeScript\` · \`Go\` · \`Rust\` · \`Next.js\` · \`Docker\`\n\nFeel free to send a **Coding Partner** request or collaborate on open workspaces!`,
    pinned_project_ids: ['proj-welcome-demo'],
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
    privacy: {
      show_location: true,
      show_education: true,
      show_links: true,
      show_skills: true,
      show_activity: true,
      show_readme: true,
      show_partners: true,
      show_email: true,
    },
  },
  {
    id: 'user-bob-2222',
    email: 'bob@codecollab.io',
    full_name: 'Bob Coder',
    username: 'bob',
    role: 'Full Stack Engineer',
    location: 'Berlin, Germany',
    education: 'B.Sc. Software Engineering, TU Berlin',
    bio: 'Passionate frontend engineer obsessed with typography, micro-animations, and responsive developer workflows.',
    skills: ['React', 'TypeScript', 'TailwindCSS', 'CSS Animations', 'Vite', 'GraphQL'],
    languages: ['TypeScript', 'JavaScript', 'HTML/CSS'],
    technologies: ['Next.js', 'Monaco Editor', 'Node.js'],
    website: 'https://bobcodes.dev',
    github_username: 'bobcoder',
    linkedin_url: 'https://linkedin.com/in/bobcoder',
    collaboration_interests: ['UI Design Systems', 'Web Performance', 'Interactive Canvas'],
    readme_markdown: `# Hi there! I'm Bob 👨‍💻\n\nPassionate about creating fluid, beautiful, and tactile web interfaces that feel like native desktop software.\n\n### Current Focus\n- Monaco editor customizations & custom language grammars\n- Accessible dark mode palette architectures\n- Minimalist design aesthetics`,
    pinned_project_ids: ['proj-welcome-demo'],
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
    privacy: {
      show_location: true,
      show_education: true,
      show_links: true,
      show_skills: true,
      show_activity: true,
      show_readme: true,
      show_partners: true,
      show_email: false,
    },
  },
  {
    id: 'user-charlie-3333',
    email: 'charlie@codecollab.io',
    full_name: 'Charlie Eng',
    username: 'charlie',
    role: 'Systems & Runtime Engineer',
    location: 'London, UK',
    education: 'Imperial College London',
    bio: 'Linux kernel hacker, container runtime developer, and terminal enthusiast.',
    skills: ['Python', 'Rust', 'C++', 'Linux', 'Containers', 'WebAssembly'],
    languages: ['Python', 'Rust', 'C++'],
    technologies: ['PTY Terminal', 'Docker', 'SQLite'],
    github_username: 'charlie-eng',
    collaboration_interests: ['Server-side PTYs', 'Container security', 'Compiler optimizations'],
    readme_markdown: `# Charlie Eng\n\nSystems programming, PTY bridges, and container orchestration.\n\n*Building the engine underneath your code.*`,
    pinned_project_ids: [],
    avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie',
    privacy: {
      show_location: true,
      show_education: true,
      show_links: true,
      show_skills: true,
      show_activity: true,
      show_readme: true,
      show_partners: true,
      show_email: false,
    },
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

  removeNotificationByPartnerRequestId(partnerRequestId: string): void {
    const list = getStored<any[]>('codecollab_notifications', []);
    setStored('codecollab_notifications', list.filter(n => n.partner_request_id !== partnerRequestId && n.data?.partner_request_id !== partnerRequestId));
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

  updateNotificationAction(id: string, actionStatus: string): void {
    const list = getStored<any[]>('codecollab_notifications', []);
    const target = list.find(n => n.id === id);
    if (target) {
      target.action_status = actionStatus;
      target.read = true;
      setStored('codecollab_notifications', list);
    }
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
  },

  dismissNotification(id: string): void {
    const list = getStored<any[]>('codecollab_notifications', []);
    setStored('codecollab_notifications', list.filter(n => n.id !== id));
  },

  clearAllNotifications(userId: string): void {
    const list = getStored<any[]>('codecollab_notifications', []);
    setStored('codecollab_notifications', list.filter(n => n.user_id !== userId));
  },

  // Level 8: Direct Developer Messaging & Profile Lookups
  getProfileByUsername(username: string): UserProfile | null {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    const users = getStored<UserProfile[]>(STORAGE_KEY_USERS, DEMO_USERS);
    return users.find(u => (u.username?.toLowerCase() === clean) || (u.id === clean)) || null;
  },

  getAllProfiles(): UserProfile[] {
    return getStored<UserProfile[]>(STORAGE_KEY_USERS, DEMO_USERS);
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


