import type { Monaco } from '@monaco-editor/react';

export type ThemeId =
  | 'dark'
  | 'light'
  | 'midnight'
  | 'dracula'
  | 'monokai'
  | 'nord'
  | 'solarized'
  | 'high-contrast';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  type: 'dark' | 'light';
  monacoTheme: string;
  colors: {
    bg: string;
    sidebar: string;
    activity: string;
    dock: string;
    dockHeader: string;
    tabActive: string;
    tabInactive: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    statusBar: string;
    statusBarText: string;
    inputBg: string;
    cardBg: string;
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  dark: {
    id: 'dark',
    name: 'CodeCollab Dark',
    description: 'Classic professional dark theme inspired by modern developer IDEs',
    type: 'dark',
    monacoTheme: 'cc-dark',
    colors: {
      bg: '#1e1e1e',
      sidebar: '#252526',
      activity: '#333333',
      dock: '#181818',
      dockHeader: '#252526',
      tabActive: '#1e1e1e',
      tabInactive: '#2d2d2d',
      border: '#3c3c3c',
      text: '#cccccc',
      textMuted: '#858585',
      accent: '#007acc',
      accentHover: '#0098ff',
      statusBar: '#007acc',
      statusBarText: '#ffffff',
      inputBg: '#3c3c3c',
      cardBg: '#252526',
    },
  },
  light: {
    id: 'light',
    name: 'CodeCollab Light',
    description: 'Crisp, high-readability daylight theme for well-lit environments',
    type: 'light',
    monacoTheme: 'cc-light',
    colors: {
      bg: '#ffffff',
      sidebar: '#f3f3f3',
      activity: '#2c2c2c',
      dock: '#f8f8f8',
      dockHeader: '#eaeaea',
      tabActive: '#ffffff',
      tabInactive: '#ececec',
      border: '#e5e5e5',
      text: '#333333',
      textMuted: '#717171',
      accent: '#0066b8',
      accentHover: '#007acc',
      statusBar: '#007acc',
      statusBarText: '#ffffff',
      inputBg: '#ffffff',
      cardBg: '#f9f9f9',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Black',
    description: 'Deep OLED pure black with high-contrast glowing accents',
    type: 'dark',
    monacoTheme: 'cc-midnight',
    colors: {
      bg: '#0a0d14',
      sidebar: '#0f141c',
      activity: '#080a0f',
      dock: '#07090e',
      dockHeader: '#0e121a',
      tabActive: '#0a0d14',
      tabInactive: '#131923',
      border: '#1e2638',
      text: '#e2e8f0',
      textMuted: '#64748b',
      accent: '#38bdf8',
      accentHover: '#0ea5e9',
      statusBar: '#0284c7',
      statusBarText: '#ffffff',
      inputBg: '#131923',
      cardBg: '#0f141c',
    },
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula Violet',
    description: 'Vibrant purple, cyan, and pink palette beloved by programmers',
    type: 'dark',
    monacoTheme: 'cc-dracula',
    colors: {
      bg: '#282a36',
      sidebar: '#21222c',
      activity: '#191a21',
      dock: '#1e1f29',
      dockHeader: '#242632',
      tabActive: '#282a36',
      tabInactive: '#1f2029',
      border: '#44475a',
      text: '#f8f8f2',
      textMuted: '#6272a4',
      accent: '#bd93f9',
      accentHover: '#ff79c6',
      statusBar: '#6272a4',
      statusBarText: '#f8f8f2',
      inputBg: '#343746',
      cardBg: '#21222c',
    },
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai Pro',
    description: 'Warm charcoal background with distinct yellow, magenta, and lime tokens',
    type: 'dark',
    monacoTheme: 'cc-monokai',
    colors: {
      bg: '#272822',
      sidebar: '#1e1f1c',
      activity: '#171814',
      dock: '#1b1c18',
      dockHeader: '#22231e',
      tabActive: '#272822',
      tabInactive: '#1d1e1a',
      border: '#3e3d32',
      text: '#f8f8f2',
      textMuted: '#75715e',
      accent: '#e6db74',
      accentHover: '#f92672',
      statusBar: '#a6e22e',
      statusBarText: '#1e1f1c',
      inputBg: '#383830',
      cardBg: '#1e1f1c',
    },
  },
  nord: {
    id: 'nord',
    name: 'Nordic Frost',
    description: 'Calm, arctic bluish-gray palette created for elegant minimalism',
    type: 'dark',
    monacoTheme: 'cc-nord',
    colors: {
      bg: '#2e3440',
      sidebar: '#272c36',
      activity: '#20242c',
      dock: '#232731',
      dockHeader: '#2a2f3b',
      tabActive: '#2e3440',
      tabInactive: '#242933',
      border: '#3b4252',
      text: '#eceff4',
      textMuted: '#7c889d',
      accent: '#88c0d0',
      accentHover: '#81a1c1',
      statusBar: '#5e81ac',
      statusBarText: '#eceff4',
      inputBg: '#3b4252',
      cardBg: '#272c36',
    },
  },
  solarized: {
    id: 'solarized',
    name: 'Solarized Dark',
    description: 'Precision colors designed with calibrated cyan, teal, and amber tones',
    type: 'dark',
    monacoTheme: 'cc-solarized',
    colors: {
      bg: '#002b36',
      sidebar: '#00212b',
      activity: '#001821',
      dock: '#001c24',
      dockHeader: '#002530',
      tabActive: '#002b36',
      tabInactive: '#001e26',
      border: '#073642',
      text: '#93a1a1',
      textMuted: '#586e75',
      accent: '#2aa198',
      accentHover: '#268bd2',
      statusBar: '#268bd2',
      statusBarText: '#fdf6e3',
      inputBg: '#073642',
      cardBg: '#00212b',
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Ultra-clear black with pure white borders and maximal readability',
    type: 'dark',
    monacoTheme: 'hc-black',
    colors: {
      bg: '#000000',
      sidebar: '#000000',
      activity: '#000000',
      dock: '#000000',
      dockHeader: '#000000',
      tabActive: '#000000',
      tabInactive: '#000000',
      border: '#6fc1ff',
      text: '#ffffff',
      textMuted: '#aaaaaa',
      accent: '#f38518',
      accentHover: '#ffd300',
      statusBar: '#000000',
      statusBarText: '#ffffff',
      inputBg: '#000000',
      cardBg: '#000000',
    },
  },
};

/**
 * Register custom Monaco themes matching CodeCollab IDE themes
 */
export function registerMonacoThemes(monaco: Monaco) {
  // Dark Theme
  monaco.editor.defineTheme('cc-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'identifier', foreground: '9CDCFE' },
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorLineNumber.foreground': '#858585',
      'editorLineNumber.activeForeground': '#c6c6c6',
      'editor.lineHighlightBackground': '#282828',
      'editorCursor.foreground': '#aeafad',
      'editorWhitespace.foreground': '#3e3e3e',
    },
  });

  // Light Theme
  monaco.editor.defineTheme('cc-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267f99' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#999999',
      'editorLineNumber.activeForeground': '#333333',
      'editor.lineHighlightBackground': '#f3f6f9',
    },
  });

  // Midnight Black
  monaco.editor.defineTheme('cc-midnight', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '475569' },
      { token: 'keyword', foreground: '38bdf8' },
      { token: 'string', foreground: '34d399' },
      { token: 'number', foreground: 'f472b6' },
      { token: 'type', foreground: '818cf8' },
      { token: 'identifier', foreground: 'e2e8f0' },
    ],
    colors: {
      'editor.background': '#0a0d14',
      'editor.foreground': '#e2e8f0',
      'editorLineNumber.foreground': '#334155',
      'editorLineNumber.activeForeground': '#38bdf8',
      'editor.lineHighlightBackground': '#111724',
      'editorCursor.foreground': '#38bdf8',
    },
  });

  // Dracula Theme
  monaco.editor.defineTheme('cc-dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'type', foreground: '8be9fd' },
      { token: 'identifier', foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#bd93f9',
      'editor.lineHighlightBackground': '#343746',
      'editorCursor.foreground': '#f8f8f0',
    },
  });

  // Monokai Pro
  monaco.editor.defineTheme('cc-monokai', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '75715e' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'type', foreground: '66d9ef' },
      { token: 'identifier', foreground: 'f8f8f2' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#f8f8f2',
      'editorLineNumber.foreground': '#75715e',
      'editorLineNumber.activeForeground': '#e6db74',
      'editor.lineHighlightBackground': '#3e3d32',
      'editorCursor.foreground': '#f8f8f0',
    },
  });

  // Nord Theme
  monaco.editor.defineTheme('cc-nord', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '616e88' },
      { token: 'keyword', foreground: '81a1c1' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'type', foreground: '8fbcbb' },
      { token: 'identifier', foreground: 'eceff4' },
    ],
    colors: {
      'editor.background': '#2e3440',
      'editor.foreground': '#eceff4',
      'editorLineNumber.foreground': '#4c566a',
      'editorLineNumber.activeForeground': '#88c0d0',
      'editor.lineHighlightBackground': '#3b4252',
      'editorCursor.foreground': '#d8dee9',
    },
  });

  // Solarized Dark
  monaco.editor.defineTheme('cc-solarized', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '586e75' },
      { token: 'keyword', foreground: '859900' },
      { token: 'string', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'type', foreground: 'b58900' },
      { token: 'identifier', foreground: '93a1a1' },
    ],
    colors: {
      'editor.background': '#002b36',
      'editor.foreground': '#93a1a1',
      'editorLineNumber.foreground': '#586e75',
      'editorLineNumber.activeForeground': '#2aa198',
      'editor.lineHighlightBackground': '#073642',
      'editorCursor.foreground': '#93a1a1',
    },
  });
}

/**
 * Apply CSS variables to root element
 */
export function applyThemeVariables(themeId: ThemeId) {
  if (typeof document === 'undefined') return;
  const theme = THEMES[themeId] || THEMES.dark;
  const root = document.documentElement;

  root.style.setProperty('--ide-bg', theme.colors.bg);
  root.style.setProperty('--ide-sidebar', theme.colors.sidebar);
  root.style.setProperty('--ide-activity', theme.colors.activity);
  root.style.setProperty('--ide-dock', theme.colors.dock);
  root.style.setProperty('--ide-dock-header', theme.colors.dockHeader);
  root.style.setProperty('--ide-tab-active', theme.colors.tabActive);
  root.style.setProperty('--ide-tab-inactive', theme.colors.tabInactive);
  root.style.setProperty('--ide-border', theme.colors.border);
  root.style.setProperty('--ide-text', theme.colors.text);
  root.style.setProperty('--ide-text-muted', theme.colors.textMuted);
  root.style.setProperty('--ide-accent', theme.colors.accent);
  root.style.setProperty('--ide-accent-hover', theme.colors.accentHover);
  root.style.setProperty('--ide-status-bg', theme.colors.statusBar);
  root.style.setProperty('--ide-status-text', theme.colors.statusBarText);
  root.style.setProperty('--ide-input-bg', theme.colors.inputBg);
  root.style.setProperty('--ide-card-bg', theme.colors.cardBg);

  root.setAttribute('data-theme', themeId);
}
