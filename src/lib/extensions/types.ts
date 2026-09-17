export type ExtensionPermission = 
  | 'commands'
  | 'ui.panel'
  | 'editor.decorations'
  | 'theme'
  | 'shortcuts'
  | 'storage.local'
  | 'network.fetch';

export interface ExtensionCommandContribution {
  id: string;
  title: string;
  category?: string;
  shortcut?: string;
}

export interface ExtensionPanelContribution {
  id: string;
  title: string;
  icon?: string;
  location: 'sidebar' | 'bottom';
}

export interface ExtensionThemeContribution {
  id: string;
  label: string;
  uiTheme: 'vs-dark' | 'vs' | 'hc-black';
}

export interface ExtensionContributions {
  commands?: ExtensionCommandContribution[];
  panels?: ExtensionPanelContribution[];
  themes?: ExtensionThemeContribution[];
  keybindings?: { command: string; key: string }[];
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: 'Editor' | 'Languages' | 'Themes' | 'Collaboration' | 'Productivity';
  icon?: string;
  permissions: ExtensionPermission[];
  activationEvents: ('onStartup' | 'onLanguage:*' | 'onCommand:*')[];
  contributions: ExtensionContributions;
  homepage?: string;
}

export interface ExtensionInstance {
  manifest: ExtensionManifest;
  enabled: boolean;
  active: boolean;
  installedAt: string;
}
