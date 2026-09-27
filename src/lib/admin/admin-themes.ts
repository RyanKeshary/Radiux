'use client';

export type AdminThemeId = 'obsidian' | 'midnight' | 'graphite' | 'aurora' | 'light';

export interface AdminThemeDefinition {
  id: AdminThemeId;
  name: string;
  description: string;
  type: 'dark' | 'light';
  colors: {
    bg: string;
    surface: string;
    surfaceHover: string;
    surfaceSubtle: string;
    border: string;
    borderSubtle: string;
    accent: string;
    accentHover: string;
    accentGlow: string;
    text: string;
    textMuted: string;
    statusOk: string;
    statusWarn: string;
    statusError: string;
    statusInfo: string;
    chartGrid: string;
    chartLine: string;
    chartFill: string;
  };
}

export const ADMIN_THEMES: Record<AdminThemeId, AdminThemeDefinition> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Dark neutral IDE aesthetic with precision high-contrast typography.',
    type: 'dark',
    colors: {
      bg: '#0c0e12',
      surface: '#141820',
      surfaceHover: '#1c2230',
      surfaceSubtle: '#0f1218',
      border: '#232938',
      borderSubtle: '#181e2b',
      accent: '#0284c7',
      accentHover: '#38bdf8',
      accentGlow: 'rgba(56, 189, 248, 0.15)',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      statusOk: '#10b981',
      statusWarn: '#f59e0b',
      statusError: '#ef4444',
      statusInfo: '#38bdf8',
      chartGrid: 'rgba(255, 255, 255, 0.05)',
      chartLine: '#38bdf8',
      chartFill: 'rgba(56, 189, 248, 0.12)',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep cosmic dark blue aesthetic with soft indigo accents.',
    type: 'dark',
    colors: {
      bg: '#070913',
      surface: '#0f1426',
      surfaceHover: '#17203b',
      surfaceSubtle: '#0a0d1b',
      border: '#1f2a4d',
      borderSubtle: '#141b33',
      accent: '#6366f1',
      accentHover: '#818cf8',
      accentGlow: 'rgba(129, 140, 248, 0.18)',
      text: '#e2e8f0',
      textMuted: '#818cf8',
      statusOk: '#34d399',
      statusWarn: '#fbbf24',
      statusError: '#f87171',
      statusInfo: '#818cf8',
      chartGrid: 'rgba(129, 140, 248, 0.08)',
      chartLine: '#818cf8',
      chartFill: 'rgba(99, 102, 241, 0.15)',
    },
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    description: 'Monochrome slate aesthetic engineered for focused administrative workflows.',
    type: 'dark',
    colors: {
      bg: '#121214',
      surface: '#1a1a1e',
      surfaceHover: '#242429',
      surfaceSubtle: '#161619',
      border: '#2c2c33',
      borderSubtle: '#202026',
      accent: '#d4d4d8',
      accentHover: '#ffffff',
      accentGlow: 'rgba(255, 255, 255, 0.1)',
      text: '#fafafa',
      textMuted: '#a1a1aa',
      statusOk: '#4ade80',
      statusWarn: '#facc15',
      statusError: '#fb7185',
      statusInfo: '#a1a1aa',
      chartGrid: 'rgba(255, 255, 255, 0.04)',
      chartLine: '#e4e4e7',
      chartFill: 'rgba(255, 255, 255, 0.08)',
    },
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Subtle dark emerald and teal accents inspired by northern lights.',
    type: 'dark',
    colors: {
      bg: '#081010',
      surface: '#0d1a19',
      surfaceHover: '#132826',
      surfaceSubtle: '#091413',
      border: '#1a3835',
      borderSubtle: '#122624',
      accent: '#10b981',
      accentHover: '#34d399',
      accentGlow: 'rgba(52, 211, 153, 0.16)',
      text: '#ecfdf5',
      textMuted: '#6ee7b7',
      statusOk: '#34d399',
      statusWarn: '#fbbf24',
      statusError: '#f87171',
      statusInfo: '#2dd4bf',
      chartGrid: 'rgba(52, 211, 153, 0.06)',
      chartLine: '#34d399',
      chartFill: 'rgba(16, 185, 129, 0.14)',
    },
  },
  light: {
    id: 'light',
    name: 'Light',
    description: 'Clean high-readability daylight theme for high-brightness operations.',
    type: 'light',
    colors: {
      bg: '#f8fafc',
      surface: '#ffffff',
      surfaceHover: '#f1f5f9',
      surfaceSubtle: '#f8fafc',
      border: '#e2e8f0',
      borderSubtle: '#edf2f7',
      accent: '#0284c7',
      accentHover: '#0369a1',
      accentGlow: 'rgba(2, 132, 199, 0.12)',
      text: '#0f172a',
      textMuted: '#64748b',
      statusOk: '#059669',
      statusWarn: '#d97706',
      statusError: '#dc2626',
      statusInfo: '#0284c7',
      chartGrid: 'rgba(0, 0, 0, 0.05)',
      chartLine: '#0284c7',
      chartFill: 'rgba(2, 132, 199, 0.08)',
    },
  },
};

const STORAGE_KEY = 'radiux_admin_theme';

export function getStoredAdminTheme(): AdminThemeId {
  if (typeof window === 'undefined') return 'obsidian';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as AdminThemeId;
    if (saved && ADMIN_THEMES[saved]) return saved;
  } catch {}
  return 'obsidian';
}

export function setStoredAdminTheme(themeId: AdminThemeId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
    applyAdminTheme(themeId);
  } catch {}
}

export const getSavedAdminTheme = getStoredAdminTheme;
export const setSavedAdminTheme = setStoredAdminTheme;

export function applyAdminTheme(themeId: AdminThemeId) {
  if (typeof document === 'undefined') return;
  const theme = ADMIN_THEMES[themeId] || ADMIN_THEMES.obsidian;
  const root = document.documentElement;

  root.style.setProperty('--admin-bg', theme.colors.bg);
  root.style.setProperty('--admin-surface', theme.colors.surface);
  root.style.setProperty('--admin-surface-hover', theme.colors.surfaceHover);
  root.style.setProperty('--admin-surface-subtle', theme.colors.surfaceSubtle);
  root.style.setProperty('--admin-border', theme.colors.border);
  root.style.setProperty('--admin-border-subtle', theme.colors.borderSubtle);
  root.style.setProperty('--admin-accent', theme.colors.accent);
  root.style.setProperty('--admin-accent-hover', theme.colors.accentHover);
  root.style.setProperty('--admin-accent-glow', theme.colors.accentGlow);
  root.style.setProperty('--admin-text', theme.colors.text);
  root.style.setProperty('--admin-text-muted', theme.colors.textMuted);
  root.style.setProperty('--admin-status-ok', theme.colors.statusOk);
  root.style.setProperty('--admin-status-warn', theme.colors.statusWarn);
  root.style.setProperty('--admin-status-error', theme.colors.statusError);
  root.style.setProperty('--admin-status-info', theme.colors.statusInfo);

  root.setAttribute('data-admin-theme', themeId);
}
