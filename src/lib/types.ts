export type LanguageType = 
  | 'javascript'
  | 'typescript'
  | 'html'
  | 'css'
  | 'json'
  | 'python'
  | 'plaintext';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  role?: 'owner' | 'member';
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'member';
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
