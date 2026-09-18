import { User } from '@supabase/supabase-js';

export interface NormalizedProfile {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string;
  username: string;
  github_username: string;
  provider: string;
  providers: string[];
}

/**
 * Safely extracts and normalizes user profile data from Supabase Auth User object.
 * Gracefully handles Google, GitHub, and Email OAuth metadata variations.
 * 
 * Google provides: name, full_name, picture, avatar_url, email
 * GitHub provides: user_name, preferred_username, name, avatar_url, email
 */
export function normalizeOAuthUser(user: User | null | undefined): NormalizedProfile {
  if (!user) {
    return {
      id: '',
      email: '',
      full_name: 'Radiux User',
      display_name: 'Radiux User',
      avatar_url: '',
      username: 'user',
      github_username: '',
      provider: 'email',
      providers: [],
    };
  }

  const metadata = user.user_metadata || {};
  const appMeta = user.app_metadata || {};
  const identities = user.identities || [];

  // 1. Determine provider(s)
  const primaryProvider = appMeta.provider || (identities.length > 0 ? identities[0].provider : 'email');
  const providers: string[] = Array.from(
    new Set([primaryProvider, ...identities.map((i: any) => i.provider).filter(Boolean)])
  );

  // 2. Extract GitHub identity data if available
  const githubIdentity = identities.find((i: any) => i.provider === 'github');
  const githubData = githubIdentity?.identity_data || {};

  // 3. Name fallback order:
  // full_name → name → user_name → email prefix → "Radiux User"
  const fullName =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    githubData.name ||
    githubData.user_name ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Radiux User';

  const displayName =
    metadata.display_name ||
    fullName;

  // 4. Avatar fallback:
  // avatar_url → picture → identity avatar → ''
  const avatarUrl =
    metadata.avatar_url ||
    metadata.picture ||
    githubData.avatar_url ||
    '';

  // 5. GitHub username extraction:
  const githubUsername =
    metadata.github_username ||
    metadata.user_name ||
    metadata.preferred_username ||
    githubData.user_name ||
    githubData.preferred_username ||
    '';

  // 6. Username fallback order:
  const username =
    metadata.username ||
    githubUsername ||
    (user.email ? user.email.split('@')[0] : '') ||
    `user_${user.id.slice(0, 8)}`;

  return {
    id: user.id,
    email: user.email || metadata.email || '',
    full_name: fullName,
    display_name: displayName,
    avatar_url: avatarUrl,
    username,
    github_username: githubUsername,
    provider: primaryProvider,
    providers,
  };
}
