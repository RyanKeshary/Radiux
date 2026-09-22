export type LanguageType = 
  | 'javascript'
  | 'typescript'
  | 'html'
  | 'css'
  | 'json'
  | 'python'
  | 'plaintext';

export interface ProfilePrivacySettings {
  show_location?: boolean;
  show_education?: boolean;
  show_education_history?: boolean;
  show_links?: boolean;
  show_skills?: boolean;
  show_activity?: boolean;
  show_readme?: boolean;
  show_partners?: boolean;
  show_email?: boolean;
}

export interface CustomDeveloperLink {
  id: string;
  title: string;
  url: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  display_name?: string;
  avatar_url?: string;
  username?: string;
  bio?: string;
  role?: string;
  location?: string;
  education?: string;
  skills?: string[];
  languages?: string[];
  technologies?: string[];
  website?: string;
  github_username?: string;
  linkedin_url?: string;
  other_links?: CustomDeveloperLink[];
  collaboration_interests?: string[];
  readme_markdown?: string;
  pinned_project_ids?: string[]; // Maximum 4 projects
  privacy?: ProfilePrivacySettings;
  preferences?: Record<string, any>;
  provider?: string;
  providers?: string[];
  identities?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio' | 'file';
  media_name?: string;
}

export interface ContributionDay {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  details?: { type: string; label: string; count: number }[];
}

export interface CommandDefinition {
  id: string;
  title: string;
  category: string;
  description?: string;
  defaultShortcut?: string;
  customShortcut?: string;
  action?: () => void;
}

export interface EditorGroup {
  id: string;
  openFiles: FileItem[];
  activeFileId: string | null;
}

export interface CodingPartner {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'none' | 'pending' | 'accepted' | 'ignored' | 'rejected' | 'cancelled' | 'declined';
  created_at: string;
  updated_at: string;
  profile?: UserProfile;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'partner_request' | 'partner_accepted' | 'partner_declined' | 'project_invite' | 'mention' | 'member_joined' | 'system';
  title: string;
  message: string;
  sender_name?: string;
  sender_avatar?: string;
  sender_id?: string;
  project_id?: string;
  partner_request_id?: string;
  action_status?: 'pending' | 'accepted' | 'ignored' | 'rejected' | 'completed';
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

export type WorkspaceRole = 'owner' | 'editor' | 'visitor' | 'member';

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  role?: WorkspaceRole;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  profile?: UserProfile;
}

export interface FileItem {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  is_folder: boolean;
  content?: string;
  language?: LanguageType;
  media_type?: 'image' | 'video' | 'audio' | 'file';
  created_at: string;
  updated_at: string;
  children?: FileItem[];
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  cursor?: {
    lineNumber: number;
    column: number;
  };
  currentFileId?: string | null;
}

export function detectLanguage(fileName: string): LanguageType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'py':
    case 'pyw':
      return 'python';
    default:
      return 'plaintext';
  }
}

export const USER_COLORS = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#34d399', // emerald
  '#38bdf8', // light blue
  '#818cf8', // indigo
  '#c084fc', // purple
  '#f472b6', // pink
];

export function getUserColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// Level 4: Communication & Collaboration Types

export interface ChatMessage {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
  media_type?: 'image' | 'video' | 'audio' | 'file';
  media_url?: string;
  media_name?: string;
}

// All event types for the Level 6 activity system
export type ActivityActionType =
  // Project events
  | 'project_created'
  | 'project_renamed'
  // Workspace / member events
  | 'member_joined'
  | 'member_left'
  | 'member_invited'
  | 'member_removed'
  // File events
  | 'file_created'
  | 'file_saved'
  | 'file_renamed'
  | 'file_deleted'
  | 'file_moved'
  | 'folder_created'
  | 'folder_deleted'
  | 'media_uploaded'
  // Git events
  | 'git_init'
  | 'git_commit'
  | 'git_push'
  | 'git_pull'
  | 'git_branch_created'
  | 'git_branch_deleted'
  | 'git_branch_switched'
  | 'git_remote_configured'
  | 'git_staged'
  | 'git_unstaged'
  // Voice events
  | 'voice_joined'
  | 'voice_left'
  | 'voice_muted'
  | 'voice_unmuted'
  // Runtime events
  | 'server_started'
  | 'server_stopped';

export interface ActivityEvent {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  action_type: ActivityActionType;
  /** Human-readable description of the event */
  details: string;
  /** The object affected (file name, branch name, user name, etc.) */
  target_object?: string;
  created_at: string;
}

export function isMediaFile(fileName: string): { isMedia: boolean; type: 'image' | 'video' | 'audio' | 'none' } {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif'];
  const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];

  if (ext && imageExts.includes(ext)) {
    return { isMedia: true, type: 'image' };
  }
  if (ext && videoExts.includes(ext)) {
    return { isMedia: true, type: 'video' };
  }
  if (ext && audioExts.includes(ext)) {
    return { isMedia: true, type: 'audio' };
  }
  return { isMedia: false, type: 'none' };
}

export interface VoicePeer {
  peerId: string;
  userId: string;
  userName: string;
  userColor: string;
  isMuted: boolean;
}

// Level 5: Git, GitHub, Import & Export Types

export interface GitFileChange {
  path: string;
  status: string; // 'M' | 'A' | 'D' | 'U' | 'R'
  description: string;
}

export interface GitLastCommit {
  hash: string;
  author: string;
  relativeDate: string;
  message: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
  clean: boolean;
  lastCommit?: GitLastCommit | null;
  error?: string;
}

export interface GitCommit {
  fullHash: string;
  hash: string;
  author: string;
  email: string;
  relativeDate: string;
  date: string;
  message: string;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
}

export interface GitHubRemote {
  name: string;
  url: string;
}

export interface WorkspaceExportManifest {
  version: string;
  exported_at: string;
  workspace_name?: string;
  projects: {
    id: string;
    name: string;
    description?: string;
    created_at?: string;
  }[];
}


