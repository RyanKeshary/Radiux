'use client';

import { StorageMock } from './storage-mock';

export type CommandScope = 
  | 'Global' 
  | 'Editor' 
  | 'Terminal' 
  | 'File Explorer' 
  | 'Chat' 
  | 'Search' 
  | 'Git' 
  | 'Profile' 
  | 'Modal';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  description: string;
  defaultShortcut: string;
  macShortcut?: string;
  scope: CommandScope;
  enabled?: boolean;
  actionId: string;
}

export const CORE_COMMANDS: CommandItem[] = [
  // General & Workbench
  {
    id: 'workbench.action.showCommands',
    title: 'Show Command Palette',
    category: 'View',
    description: 'Open the universal command palette to run actions',
    defaultShortcut: 'Ctrl+Shift+P',
    macShortcut: 'Cmd+Shift+P',
    scope: 'Global',
    enabled: true,
    actionId: 'commandPalette',
  },
  {
    id: 'workbench.action.quickOpen',
    title: 'Quick Open (Navigate Files)',
    category: 'File',
    description: 'Quickly find and open files by name',
    defaultShortcut: 'Ctrl+P',
    macShortcut: 'Cmd+P',
    scope: 'Global',
    enabled: true,
    actionId: 'quickOpen',
  },
  {
    id: 'workbench.action.findInFiles',
    title: 'Search in Workspace',
    category: 'Search',
    description: 'Find text and symbols across all project files',
    defaultShortcut: 'Ctrl+Shift+F',
    macShortcut: 'Cmd+Shift+F',
    scope: 'Global',
    enabled: true,
    actionId: 'globalSearch',
  },
  {
    id: 'workbench.action.toggleSidebarVisibility',
    title: 'Toggle Primary Sidebar',
    category: 'View',
    description: 'Show or hide the primary sidebar',
    defaultShortcut: 'Ctrl+B',
    macShortcut: 'Cmd+B',
    scope: 'Global',
    enabled: true,
    actionId: 'toggleSidebar',
  },
  {
    id: 'workbench.action.terminal.toggleTerminal',
    title: 'Toggle Terminal / Bottom Dock',
    category: 'Terminal',
    description: 'Show or hide the interactive cloud terminal dock',
    defaultShortcut: 'Ctrl+`',
    macShortcut: 'Cmd+`',
    scope: 'Global',
    enabled: true,
    actionId: 'toggleDock',
  },
  {
    id: 'workbench.action.toggleNotifications',
    title: 'Toggle Notifications Panel',
    category: 'View',
    description: 'Open or close the notifications center drawer',
    defaultShortcut: 'Ctrl+Alt+B',
    macShortcut: 'Cmd+Alt+B',
    scope: 'Global',
    enabled: true,
    actionId: 'toggleNotifications',
  },

  // Editor Tabs & Splitting
  {
    id: 'workbench.action.closeActiveEditor',
    title: 'Close Active Editor Tab',
    category: 'Editor',
    description: 'Close the file currently active in the focused split',
    defaultShortcut: 'Alt+W',
    macShortcut: 'Option+W',
    scope: 'Editor',
    enabled: true,
    actionId: 'closeActiveTab',
  },
  {
    id: 'workbench.action.splitEditor',
    title: 'Split Editor Vertically',
    category: 'Editor',
    description: 'Split the current editor group to the right',
    defaultShortcut: 'Ctrl+\\',
    macShortcut: 'Cmd+\\',
    scope: 'Editor',
    enabled: true,
    actionId: 'splitRight',
  },
  {
    id: 'workbench.action.files.save',
    title: 'Save File',
    category: 'File',
    description: 'Synchronize editor contents to workspace storage',
    defaultShortcut: 'Ctrl+S',
    macShortcut: 'Cmd+S',
    scope: 'Editor',
    enabled: true,
    actionId: 'saveFile',
  },
  {
    id: 'workbench.action.nextEditor',
    title: 'Cycle Through Open Tabs (Next)',
    category: 'Editor',
    description: 'Switch to the next tab in the active group',
    defaultShortcut: 'Alt+Tab',
    macShortcut: 'Option+Tab',
    scope: 'Editor',
    enabled: true,
    actionId: 'cycleTabNext',
  },
  {
    id: 'workbench.action.previousEditor',
    title: 'Cycle Through Open Tabs (Previous)',
    category: 'Editor',
    description: 'Switch to the previous tab in the active group',
    defaultShortcut: 'Alt+Shift+Tab',
    macShortcut: 'Option+Shift+Tab',
    scope: 'Editor',
    enabled: true,
    actionId: 'cycleTabPrev',
  },

  // Focus Navigation & Views
  {
    id: 'workbench.view.explorer',
    title: 'Focus Files Explorer',
    category: 'View',
    description: 'Open files explorer in the sidebar',
    defaultShortcut: 'Ctrl+Shift+E',
    macShortcut: 'Cmd+Shift+E',
    scope: 'Global',
    enabled: true,
    actionId: 'focusExplorer',
  },
  {
    id: 'workbench.view.scm',
    title: 'Focus Source Control (Git)',
    category: 'View',
    description: 'Open Git changes and commit staging',
    defaultShortcut: 'Ctrl+Shift+G',
    macShortcut: 'Cmd+Shift+G',
    scope: 'Global',
    enabled: true,
    actionId: 'focusGit',
  },
  {
    id: 'workbench.view.collaborators',
    title: 'Focus Collaborators Panel',
    category: 'Collaboration',
    description: 'View active peers, presence, and coding partners',
    defaultShortcut: 'Ctrl+Shift+C',
    macShortcut: 'Cmd+Shift+C',
    scope: 'Global',
    enabled: true,
    actionId: 'focusCollaborators',
  },
  {
    id: 'workbench.view.chat',
    title: 'Focus Project Chat',
    category: 'Collaboration',
    description: 'Jump to project discussion and team channel',
    defaultShortcut: 'Ctrl+Alt+C',
    macShortcut: 'Cmd+Alt+C',
    scope: 'Global',
    enabled: true,
    actionId: 'focusChat',
  },

  // Social & Developer Identity
  {
    id: 'codecollab.action.openProfile',
    title: 'Open Developer Profile',
    category: 'Developer Identity',
    description: 'View and customize your personal developer profile and README',
    defaultShortcut: 'Ctrl+Shift+U',
    macShortcut: 'Cmd+Shift+U',
    scope: 'Global',
    enabled: true,
    actionId: 'openProfile',
  },
  {
    id: 'codecollab.action.discoverDevelopers',
    title: 'Discover Developers & Coding Partners',
    category: 'Developer Identity',
    description: 'Search for developers by skills, languages, and handle',
    defaultShortcut: 'Ctrl+Shift+D',
    macShortcut: 'Cmd+Shift+D',
    scope: 'Global',
    enabled: true,
    actionId: 'discoverDevelopers',
  },
  {
    id: 'codecollab.action.switchProject',
    title: 'Switch Project / Workspace',
    category: 'Project',
    description: 'Quickly jump between your workspaces',
    defaultShortcut: 'Ctrl+Alt+O',
    macShortcut: 'Cmd+Alt+O',
    scope: 'Global',
    enabled: true,
    actionId: 'switchProject',
  },
  {
    id: 'workbench.action.openSettings',
    title: 'Open Settings',
    category: 'Preferences',
    description: 'Configure editor font, theme, and environment options',
    defaultShortcut: 'Ctrl+,',
    macShortcut: 'Cmd+,',
    scope: 'Global',
    enabled: true,
    actionId: 'openSettings',
  },
];

export class CommandRegistry {
  private static isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  static getEffectiveShortcut(cmd: CommandItem): string {
    const customMap = StorageMock.getCustomShortcuts();
    if (customMap[cmd.id] !== undefined) {
      return customMap[cmd.id];
    }
    return this.isMac && cmd.macShortcut ? cmd.macShortcut : cmd.defaultShortcut;
  }

  static getAllCommands(): { item: CommandItem; shortcut: string }[] {
    return CORE_COMMANDS.map(cmd => ({
      item: cmd,
      shortcut: this.getEffectiveShortcut(cmd),
    }));
  }

  static detectShortcutConflict(
    newShortcut: string, 
    excludingCommandId?: string, 
    scope?: CommandScope
  ): CommandItem | null {
    if (!newShortcut.trim()) return null;
    const norm = this.normalizeShortcut(newShortcut);

    for (const cmd of CORE_COMMANDS) {
      if (excludingCommandId && cmd.id === excludingCommandId) continue;
      const current = this.normalizeShortcut(this.getEffectiveShortcut(cmd));
      if (current === norm) {
        // Conflicts exist if both are Global, or if either shares the same specific scope
        if (
          !scope || 
          scope === 'Global' || 
          cmd.scope === 'Global' || 
          cmd.scope === scope
        ) {
          return cmd;
        }
      }
    }
    return null;
  }

  static setCustomShortcut(
    commandId: string, 
    newShortcut: string,
    replaceConflict = false
  ): { success: boolean; conflict?: CommandItem } {
    const targetCmd = CORE_COMMANDS.find(c => c.id === commandId);
    const conflict = this.detectShortcutConflict(newShortcut, commandId, targetCmd?.scope);

    if (conflict) {
      if (replaceConflict) {
        // Clear conflicting command's shortcut
        this.unassignShortcut(conflict.id);
      } else {
        return { success: false, conflict };
      }
    }

    StorageMock.saveCustomShortcut(commandId, newShortcut);
    return { success: true };
  }

  static unassignShortcut(commandId: string): void {
    const map = StorageMock.getCustomShortcuts();
    map[commandId] = '';
    if (typeof window !== 'undefined') {
      localStorage.setItem('codecollab_custom_shortcuts', JSON.stringify(map));
    }
  }

  static resetShortcut(commandId: string): void {
    const map = StorageMock.getCustomShortcuts();
    delete map[commandId];
    if (typeof window !== 'undefined') {
      localStorage.setItem('codecollab_custom_shortcuts', JSON.stringify(map));
    }
  }

  static resetAllShortcuts(): void {
    StorageMock.resetCustomShortcuts();
  }

  static normalizeShortcut(shortcut: string): string {
    if (!shortcut) return '';
    return shortcut
      .replace(/Cmd/i, 'Ctrl')
      .replace(/Option/i, 'Alt')
      .split('+')
      .map(s => s.trim().toUpperCase())
      .sort()
      .join('+');
  }

  /**
   * Test if an active keyboard event matches a given shortcut string
   */
  static matchesEvent(e: KeyboardEvent, shortcut: string): boolean {
    if (!shortcut) return false;
    const parts = shortcut.split('+').map(p => p.trim().toUpperCase());
    
    const wantsCtrl = parts.includes('CTRL') || parts.includes('CMD');
    const wantsShift = parts.includes('SHIFT');
    const wantsAlt = parts.includes('ALT') || parts.includes('OPTION');

    const hasCtrl = e.ctrlKey || e.metaKey;
    const hasShift = e.shiftKey;
    const hasAlt = e.altKey;

    if (wantsCtrl !== hasCtrl) return false;
    if (wantsShift !== hasShift) return false;
    if (wantsAlt !== hasAlt) return false;

    // Check key
    const nonModifier = parts.filter(p => !['CTRL', 'CMD', 'SHIFT', 'ALT', 'OPTION'].includes(p))[0];
    if (!nonModifier) return false;

    let eventKey = e.key.toUpperCase();
    if (eventKey === ' ') eventKey = 'SPACE';

    return eventKey === nonModifier;
  }
}
