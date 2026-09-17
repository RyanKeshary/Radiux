import { ExtensionManifest, ExtensionInstance, ExtensionPermission } from './types';

const STORAGE_KEY_EXTENSIONS = 'radiux_installed_extensions';

const BUILT_IN_EXTENSIONS: ExtensionManifest[] = [
  {
    id: 'radiux.markdown-preview',
    name: 'Markdown Live Preview',
    version: '1.2.0',
    author: 'Radiux Core Team',
    description: 'Instant side-by-side rendered Markdown viewer with GitHub flavored formatting and math support.',
    category: 'Productivity',
    permissions: ['ui.panel', 'commands'],
    activationEvents: ['onStartup'],
    contributions: {
      commands: [
        { id: 'markdown.showPreview', title: 'Open Markdown Preview', category: 'Markdown' },
      ],
      panels: [
        { id: 'markdown-preview-dock', title: 'Markdown Preview', location: 'bottom' },
      ],
    },
  },
  {
    id: 'radiux.bracket-colorizer',
    name: 'Rainbow Brackets & Delimiters',
    version: '2.0.1',
    author: 'Radiux Community',
    description: 'Colorizes matching brackets, parentheses, and indentation guides for rapid visual syntax scanning.',
    category: 'Editor',
    permissions: ['editor.decorations'],
    activationEvents: ['onStartup'],
    contributions: {
      commands: [
        { id: 'bracketColorizer.toggle', title: 'Toggle Bracket Colorization', category: 'Editor' },
      ],
    },
  },
  {
    id: 'radiux.git-blame-lens',
    name: 'Git Blame & Authorship Lens',
    version: '1.0.4',
    author: 'Radiux Core Team',
    description: 'Subtle inline author and commit history badges directly alongside the active cursor line.',
    category: 'Collaboration',
    permissions: ['editor.decorations', 'commands'],
    activationEvents: ['onStartup'],
    contributions: {
      commands: [
        { id: 'gitLens.showLineBlame', title: 'Inspect Line Git History', category: 'Git' },
      ],
    },
  },
  {
    id: 'radiux.nord-obsidian-theme',
    name: 'Nord Obsidian Dark',
    version: '1.1.0',
    author: 'Arctic Studio',
    description: 'Cool arctic blue and obsidian dark palette designed for minimal eye strain during long coding sessions.',
    category: 'Themes',
    permissions: ['theme'],
    activationEvents: ['onStartup'],
    contributions: {
      themes: [
        { id: 'nord-obsidian', label: 'Nord Obsidian', uiTheme: 'vs-dark' },
      ],
    },
  },
];

export class ExtensionRegistry {
  private static getStored(): ExtensionInstance[] {
    if (typeof window === 'undefined') {
      return BUILT_IN_EXTENSIONS.map((m) => ({
        manifest: m,
        enabled: true,
        active: true,
        installedAt: new Date().toISOString(),
      }));
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_EXTENSIONS);
      if (!raw) {
        const initial = BUILT_IN_EXTENSIONS.map((m) => ({
          manifest: m,
          enabled: true,
          active: true,
          installedAt: new Date().toISOString(),
        }));
        localStorage.setItem(STORAGE_KEY_EXTENSIONS, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(raw);
    } catch {
      return BUILT_IN_EXTENSIONS.map((m) => ({
        manifest: m,
        enabled: true,
        active: true,
        installedAt: new Date().toISOString(),
      }));
    }
  }

  private static save(list: ExtensionInstance[]) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_EXTENSIONS, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('radiux:extensions-updated'));
    } catch (e) {
      console.error('[ExtensionRegistry] Save error:', e);
    }
  }

  static getExtensions(): ExtensionInstance[] {
    return this.getStored();
  }

  static toggleExtension(id: string, enabled: boolean): boolean {
    const list = this.getStored();
    const target = list.find((e) => e.manifest.id === id);
    if (!target) return false;

    target.enabled = enabled;
    target.active = enabled;
    this.save(list);
    return true;
  }

  static hasPermission(extensionId: string, permission: ExtensionPermission): boolean {
    const ext = this.getStored().find((e) => e.manifest.id === extensionId);
    if (!ext || !ext.enabled) return false;
    return ext.manifest.permissions.includes(permission);
  }

  static getAllContributedCommands() {
    const list = this.getStored().filter((e) => e.enabled);
    return list.flatMap((e) => e.manifest.contributions.commands || []);
  }
}
