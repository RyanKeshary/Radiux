'use client';

import { CommandDefinition } from './types';
import { StorageMock } from './storage-mock';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  description: string;
  defaultShortcut: string;
  macShortcut?: string;
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
    actionId: 'commandPalette',
  },
  {
    id: 'workbench.action.quickOpen',
    title: 'Quick Open (Navigate Files)',
    category: 'File',
    description: 'Quickly find and open files by name',
    defaultShortcut: 'Ctrl+P',
    macShortcut: 'Cmd+P',
    actionId: 'quickOpen',
  },
  {
    id: 'workbench.action.findInFiles',
    title: 'Search in Workspace',
    category: 'Search',
    description: 'Find text and symbols across all project files',
    defaultShortcut: 'Ctrl+Shift+F',
    macShortcut: 'Cmd+Shift+F',
    actionId: 'globalSearch',
  },
  {
    id: 'workbench.action.toggleSidebarVisibility',
    title: 'Toggle Primary Sidebar',
    category: 'View',
    description: 'Show or hide the primary sidebar',
    defaultShortcut: 'Ctrl+B',
    macShortcut: 'Cmd+B',
    actionId: 'toggleSidebar',
  },
  {
    id: 'workbench.action.terminal.toggleTerminal',
    title: 'Toggle Terminal / Bottom Dock',
    category: 'Terminal',
    description: 'Show or hide the interactive cloud terminal dock',
    defaultShortcut: 'Ctrl+`',
    macShortcut: 'Cmd+`',
    actionId: 'toggleDock',
  },
  {
    id: 'workbench.action.togglePanel',
    title: 'Toggle Output Panel',
    category: 'View',
    description: 'Toggle bottom panel view and logs',
    defaultShortcut: 'Ctrl+J',
    macShortcut: 'Cmd+J',
    actionId: 'toggleDock',
  },

  // Editor Tabs & Splitting
  {
    id: 'workbench.action.closeActiveEditor',
    title: 'Close Active Editor Tab',
    category: 'Editor',
    description: 'Close the file currently active in the focused split',
    defaultShortcut: 'Ctrl+W',
    macShortcut: 'Cmd+W',
    actionId: 'closeActiveTab',
  },
  {
    id: 'workbench.action.splitEditor',
    title: 'Split Editor Vertically',
    category: 'Editor',
    description: 'Split the current editor group to the right',
    defaultShortcut: 'Ctrl+\\',
    macShortcut: 'Cmd+\\',
    actionId: 'splitRight',
  },
  {
    id: 'workbench.action.files.save',
    title: 'Save File',
    category: 'File',
    description: 'Synchronize editor contents to workspace disk',
    defaultShortcut: 'Ctrl+S',
    macShortcut: 'Cmd+S',
    actionId: 'saveFile',
  },
  {
    id: 'workbench.action.nextEditor',
    title: 'Cycle Through Open Tabs (Next)',
    category: 'Editor',
    description: 'Switch to the next tab in the active group',
    defaultShortcut: 'Ctrl+Tab',
    macShortcut: 'Ctrl+Tab',
    actionId: 'cycleTabNext',
  },
  {
    id: 'workbench.action.previousEditor',
    title: 'Cycle Through Open Tabs (Previous)',
    category: 'Editor',
    description: 'Switch to the previous tab in the active group',
    defaultShortcut: 'Ctrl+Shift+Tab',
    macShortcut: 'Ctrl+Shift+Tab',
    actionId: 'cycleTabPrev',
  },

  // Focus Navigation
  {
    id: 'workbench.view.explorer',
    title: 'Focus Files Explorer',
    category: 'View',
    description: 'Open files explorer in the sidebar',
    defaultShortcut: 'Ctrl+Shift+E',
    macShortcut: 'Cmd+Shift+E',
    actionId: 'focusExplorer',
  },
  {
    id: 'workbench.view.scm',
    title: 'Focus Source Control (Git)',
    category: 'View',
    description: 'Open Git changes and commit staging',
    defaultShortcut: 'Ctrl+Shift+G',
    macShortcut: 'Cmd+Shift+G',
    actionId: 'focusGit',
  },
  {
    id: 'workbench.view.collaborators',
    title: 'Focus Collaborators Panel',
    category: 'Collaboration',
    description: 'View active peers, presence, and coding partners',
    defaultShortcut: 'Ctrl+Shift+C',
    macShortcut: 'Cmd+Shift+C',
    actionId: 'focusCollaborators',
  },

  // Social & Developer Identity
  {
    id: 'codecollab.action.openProfile',
    title: 'Open Developer Profile',
    category: 'Developer Identity',
    description: 'View and customize your personal developer profile and README',
    defaultShortcut: 'Ctrl+Shift+U',
    macShortcut: 'Cmd+Shift+U',
    actionId: 'openProfile',
  },
  {
    id: 'codecollab.action.discoverDevelopers',
    title: 'Discover Developers & Coding Partners',
    category: 'Developer Identity',
    description: 'Search for developers by skills, languages, and handle',
    defaultShortcut: 'Ctrl+Shift+D',
    macShortcut: 'Cmd+Shift+D',
    actionId: 'discoverDevelopers',
  },
  {
    id: 'codecollab.action.switchProject',
    title: 'Switch Project / Workspace',
    category: 'Project',
    description: 'Quickly jump between your workspaces',
    defaultShortcut: 'Ctrl+Alt+O',
    macShortcut: 'Cmd+Alt+O',
    actionId: 'switchProject',
  },
  {
    id: 'workbench.action.openSettings',
    title: 'Open Settings',
    category: 'Preferences',
    description: 'Configure editor font, theme, and tab preferences',
    defaultShortcut: 'Ctrl+,',
    macShortcut: 'Cmd+,',
    actionId: 'openSettings',
  },
];

export class CommandRegistry {
  private static isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  static getEffectiveShortcut(cmd: CommandItem): string {
    const customMap = StorageMock.getCustomShortcuts();
    if (customMap[cmd.id]) {
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

  static detectShortcutConflict(newShortcut: string, excludingCommandId?: string): CommandItem | null {
    const norm = this.normalizeShortcut(newShortcut);
    for (const cmd of CORE_COMMANDS) {
      if (excludingCommandId && cmd.id === excludingCommandId) continue;
      const current = this.normalizeShortcut(this.getEffectiveShortcut(cmd));
      if (current === norm) {
        return cmd;
      }
    }
    return null;
  }

  static setCustomShortcut(commandId: string, newShortcut: string): { success: boolean; conflict?: CommandItem } {
    const conflict = this.detectShortcutConflict(newShortcut, commandId);
    if (conflict) {
      return { success: false, conflict };
    }
    StorageMock.saveCustomShortcut(commandId, newShortcut);
    return { success: true };
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

  static matchesEvent(cmdId: string, e: KeyboardEvent): boolean {
    const cmd = CORE_COMMANDS.find(c => c.id === cmdId || c.actionId === cmdId);
    if (!cmd) return false;

    const assigned = this.getEffectiveShortcut(cmd);
    const assignedNorm = this.normalizeShortcut(assigned);

    // Build combo string from KeyboardEvent
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let key = e.key;
    if (key === ' ' || key === 'Spacebar') key = 'Space';
    else if (key === '`' || key === '~') key = '`';
    else if (key.length === 1) key = key.toUpperCase();
    parts.push(key);

    const eventNorm = this.normalizeShortcut(parts.join('+'));
    if (eventNorm === assignedNorm) return true;

    // Also support default Chrome-safe alternatives if custom wasn't set
    const customMap = StorageMock.getCustomShortcuts();
    if (!customMap[cmd.id]) {
      // Check alternative safe chords:
      if (cmd.actionId === 'closeActiveTab' && (eventNorm === 'ALT+W' || eventNorm === 'CTRL+Q')) return true;
      if (cmd.actionId === 'quickOpen' && eventNorm === 'ALT+P') return true;
      if (cmd.actionId === 'commandPalette' && eventNorm === 'ALT+SHIFT+P') return true;
      if (cmd.actionId === 'toggleSidebar' && eventNorm === 'ALT+B') return true;
      if (cmd.actionId === 'toggleDock' && (eventNorm === 'ALT+`' || eventNorm === 'CTRL+J')) return true;
      if (cmd.actionId === 'globalSearch' && eventNorm === 'ALT+SHIFT+F') return true;
    }

    return false;
  }

  static normalizeShortcut(shortcut: string): string {
    return shortcut
      .replace(/Cmd/i, 'Ctrl')
      .split('+')
      .map(s => s.trim().toUpperCase())
      .sort()
      .join('+');
  }
}
