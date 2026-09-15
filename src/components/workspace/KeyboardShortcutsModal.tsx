'use client';

import React, { useState, useEffect } from 'react';
import { Keyboard, X, Search, Edit3, RotateCcw, AlertTriangle, Check } from 'lucide-react';
import { CommandRegistry, CommandItem, CORE_COMMANDS } from '@/lib/commands';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShortcutsUpdated?: () => void;
}

export function KeyboardShortcutsModal({ 
  isOpen, 
  onClose, 
  onShortcutsUpdated 
}: KeyboardShortcutsModalProps) {
  const [search, setSearch] = useState('');
  const [commandsList, setCommandsList] = useState<{ item: CommandItem; shortcut: string }[]>([]);
  const [editingCommand, setEditingCommand] = useState<CommandItem | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const refreshCommands = () => {
    setCommandsList(CommandRegistry.getAllCommands());
  };

  useEffect(() => {
    if (isOpen) {
      refreshCommands();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = commandsList.filter(({ item }) => {
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const handleStartEdit = (cmd: CommandItem) => {
    setEditingCommand(cmd);
    setRecordedKeys([]);
    setConflictWarning(null);
  };

  const handleKeyRecording = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore solitary modifier presses
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    parts.push(key);

    const combo = parts.join('+');
    setRecordedKeys(parts);

    if (editingCommand) {
      const conflict = CommandRegistry.detectShortcutConflict(combo, editingCommand.id);
      if (conflict) {
        setConflictWarning(`Conflict: Already assigned to "${conflict.title}"`);
      } else {
        setConflictWarning(null);
      }
    }
  };

  const handleSaveCustomShortcut = () => {
    if (!editingCommand || recordedKeys.length === 0) return;
    const combo = recordedKeys.join('+');
    CommandRegistry.setCustomShortcut(editingCommand.id, combo);
    refreshCommands();
    setEditingCommand(null);
    if (onShortcutsUpdated) onShortcutsUpdated();
    setSuccessMsg(`Shortcut for "${editingCommand.title}" updated.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleResetSingle = (cmdId: string) => {
    CommandRegistry.resetShortcut(cmdId);
    refreshCommands();
    if (onShortcutsUpdated) onShortcutsUpdated();
  };

  const handleResetAll = () => {
    CommandRegistry.resetAllShortcuts();
    refreshCommands();
    if (onShortcutsUpdated) onShortcutsUpdated();
    setSuccessMsg('All shortcuts reset to defaults.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none p-4">
      <div 
        className="w-full max-w-2xl rounded-xl shadow-2xl border flex flex-col overflow-hidden text-xs max-h-[85vh]"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Header */}
        <div 
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold" style={{ color: 'var(--ide-text)' }}>
              Keyboard Shortcuts & Commands
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border hover:bg-white/10 transition-colors"
              style={{ borderColor: 'var(--ide-border)' }}
              title="Reset all customized shortcuts to factory defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10"
              style={{ color: 'var(--ide-text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b" style={{ borderColor: 'var(--ide-border)' }}>
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border focus-within:ring-1 focus-within:ring-sky-500"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search commands or shortcuts (e.g. Quick Open, Terminal, Save)..."
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--ide-text)' }}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X className="w-3 h-3 text-neutral-400" />
              </button>
            )}
          </div>
        </div>

        {/* Feedback alert */}
        {successMsg && (
          <div className="mx-4 mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Shortcuts List */}
        <div className="p-4 overflow-y-auto space-y-1.5 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 text-xs">
              No matching commands found.
            </div>
          ) : (
            filtered.map(({ item, shortcut }) => {
              const isCustom = shortcut !== item.defaultShortcut;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5 group"
                  style={{
                    backgroundColor: 'var(--ide-dock-header)',
                    borderColor: 'var(--ide-border)',
                  }}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[12px] truncate" style={{ color: 'var(--ide-text)' }}>
                        {item.title}
                      </span>
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-mono opacity-60 border"
                        style={{ borderColor: 'var(--ide-border)' }}
                      >
                        {item.category}
                      </span>
                      {isCustom && (
                        <span className="text-[10px] px-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono">
                          custom
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] truncate opacity-70 mt-0.5" style={{ color: 'var(--ide-text-muted)' }}>
                      {item.description}
                    </div>
                  </div>

                  {/* Shortcut keys and Edit action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 font-mono">
                      {shortcut.split('+').map((k, ki) => (
                        <kbd
                          key={ki}
                          className="px-1.5 py-0.5 rounded text-[11px] font-semibold border shadow-sm"
                          style={{
                            backgroundColor: 'var(--ide-card-bg)',
                            borderColor: 'var(--ide-border)',
                            color: 'var(--ide-text)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>

                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-opacity"
                      title="Edit Shortcut"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                    </button>

                    {isCustom && (
                      <button
                        onClick={() => handleResetSingle(item.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-opacity"
                        title="Reset to Default"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Edit Keybinding Modal */}
        {editingCommand && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
            <div 
              className="w-full max-w-sm rounded-xl border shadow-2xl p-5 space-y-4"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
            >
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--ide-border)' }}>
                <span className="font-semibold text-xs">Edit Keybinding</span>
                <button onClick={() => setEditingCommand(null)}>
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>

              <div>
                <p className="text-xs font-medium mb-2">{editingCommand.title}</p>
                <div
                  tabIndex={0}
                  onKeyDown={handleKeyRecording}
                  className="w-full p-4 text-center rounded-lg border-2 border-dashed border-sky-500/50 outline-none cursor-pointer focus:border-sky-400 focus:bg-sky-500/5 transition-all"
                  style={{ backgroundColor: 'var(--ide-dock-header)' }}
                >
                  {recordedKeys.length === 0 ? (
                    <span className="text-xs text-neutral-400 italic">
                      Press desired keys (e.g. Ctrl + Shift + K)...
                    </span>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5 font-mono">
                      {recordedKeys.map((k, idx) => (
                        <kbd
                          key={idx}
                          className="px-2 py-1 rounded text-xs font-bold border shadow"
                          style={{
                            backgroundColor: 'var(--ide-card-bg)',
                            borderColor: 'var(--ide-border)',
                            color: 'var(--ide-text)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {conflictWarning && (
                <div className="p-2.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{conflictWarning}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCommand(null)}
                  className="px-3 py-1.5 text-xs rounded border hover:bg-white/10"
                  style={{ borderColor: 'var(--ide-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomShortcut}
                  disabled={recordedKeys.length === 0}
                  className="px-4 py-1.5 text-xs font-medium text-white rounded disabled:opacity-40"
                  style={{ backgroundColor: 'var(--ide-accent)' }}
                >
                  Save Keybinding
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
