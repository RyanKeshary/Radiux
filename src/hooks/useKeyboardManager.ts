'use client';

import { useEffect, useCallback } from 'react';
import { CommandRegistry, CommandScope } from '@/lib/commands';

export interface KeyboardActions {
  onCommandPalette?: () => void;
  onQuickOpen?: () => void;
  onGlobalSearch?: () => void;
  onToggleSidebar?: () => void;
  onToggleDock?: () => void;
  onCloseActiveTab?: () => void;
  onSplitRight?: () => void;
  onSaveFile?: () => void;
  onCycleTabNext?: () => void;
  onCycleTabPrev?: () => void;
  onFocusExplorer?: () => void;
  onFocusGit?: () => void;
  onFocusCollaborators?: () => void;
  onFocusChat?: () => void;
  onOpenProfile?: () => void;
  onDiscoverDevelopers?: () => void;
  onSwitchProject?: () => void;
  onOpenSettings?: () => void;
  onEscape?: () => boolean | void; // Return true if handled
}

/**
 * Hook providing central, scope-aware, non-colliding keyboard event handling for the IDE.
 */
export function useKeyboardManager(actions: KeyboardActions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 1. Determine active element context / scope
    const target = e.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase() || '';
    const isInput = tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;
    const isTerminal = target?.closest('.xterm') !== null || target?.closest('[data-terminal-container]') !== null;
    const isMonaco = target?.closest('.monaco-editor') !== null;

    // 2. Escape key hierarchy (Always accessible globally)
    if (e.key === 'Escape') {
      if (actions.onEscape) {
        const handled = actions.onEscape();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      return;
    }

    // 3. Never steal raw terminal keystrokes (like Ctrl+C, Ctrl+D, arrow keys in terminal)
    // Only allow global commands with modifier + Alt/Shift if intended
    if (isTerminal && !e.altKey && !e.shiftKey && e.key !== '`') {
      return;
    }

    // 4. In text inputs, suppress global hotkeys unless Ctrl/Cmd + Shift is pressed
    if (isInput) {
      // Allow user to use Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z normally
      if (e.key === 'Escape') {
        target?.blur();
        e.preventDefault();
        return;
      }
      // Only allow deliberate global action palette/search
      if (e.key !== 'p' && e.key !== 'P' && e.key !== 'k' && e.key !== 'K') {
        return;
      }
    }

    // 5. Match against CommandRegistry
    const allCommands = CommandRegistry.getAllCommands();
    for (const { item, shortcut } of allCommands) {
      if (!shortcut) continue;

      if (CommandRegistry.matchesEvent(e, shortcut)) {
        // Check scope
        if (item.scope === 'Editor' && !isMonaco && !isInput) {
          // Some editor commands (like save) can still be global if requested
          if (item.actionId !== 'saveFile') {
            continue;
          }
        }

        // Execute action
        const actionMap: Record<string, (() => void) | undefined> = {
          commandPalette: actions.onCommandPalette,
          quickOpen: actions.onQuickOpen,
          globalSearch: actions.onGlobalSearch,
          toggleSidebar: actions.onToggleSidebar,
          toggleDock: actions.onToggleDock,
          closeActiveTab: actions.onCloseActiveTab,
          splitRight: actions.onSplitRight,
          saveFile: actions.onSaveFile,
          cycleTabNext: actions.onCycleTabNext,
          cycleTabPrev: actions.onCycleTabPrev,
          focusExplorer: actions.onFocusExplorer,
          focusGit: actions.onFocusGit,
          focusCollaborators: actions.onFocusCollaborators,
          focusChat: actions.onFocusChat,
          openProfile: actions.onOpenProfile,
          discoverDevelopers: actions.onDiscoverDevelopers,
          switchProject: actions.onSwitchProject,
          openSettings: actions.onOpenSettings,
        };

        const fn = actionMap[item.actionId];
        if (fn) {
          e.preventDefault();
          e.stopPropagation();
          fn();
          return;
        }
      }
    }
  }, [actions]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
}
