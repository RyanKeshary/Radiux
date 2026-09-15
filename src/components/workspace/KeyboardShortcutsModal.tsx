'use client';

import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  const modKey = isMac ? 'Cmd' : 'Ctrl';

  const shortcutSections = [
    {
      category: 'General & Commands',
      shortcuts: [
        { keys: [`${modKey}`, 'Shift', 'P'], desc: 'Open Command Palette' },
        { keys: [`${modKey}`, 'P'], desc: 'Quick Open (Navigate Files)' },
        { keys: [`${modKey}`, 'Shift', 'F'], desc: 'Global Workspace Search' },
        { keys: [`${modKey}`, ','], desc: 'Open IDE Settings' },
        { keys: [`${modKey}`, 'Alt', 'O'], desc: 'Switch Project / Workspace' },
      ],
    },
    {
      category: 'Editor & Split Groups',
      shortcuts: [
        { keys: [`${modKey}`, '\\'], desc: 'Split Editor Vertically' },
        { keys: [`${modKey}`, 'W'], desc: 'Close Active Editor Tab' },
        { keys: [`${modKey}`, 'Tab'], desc: 'Cycle Through Open Tabs' },
        { keys: [`${modKey}`, 'S'], desc: 'Save File to Workspace Disk' },
        { keys: [`${modKey}`, 'Z'], desc: 'Undo' },
        { keys: [`${modKey}`, 'Y'], desc: 'Redo' },
      ],
    },
    {
      category: 'Panels & Views',
      shortcuts: [
        { keys: [`${modKey}`, 'B'], desc: 'Toggle Sidebar' },
        { keys: [`${modKey}`, '`'], desc: 'Toggle Terminal / Bottom Dock' },
        { keys: [`${modKey}`, 'J'], desc: 'Toggle Bottom Panel' },
        { keys: [`${modKey}`, 'Shift', 'E'], desc: 'Focus Files Explorer' },
        { keys: [`${modKey}`, 'Shift', 'G'], desc: 'Focus Source Control (Git)' },
        { keys: [`${modKey}`, 'Shift', 'C'], desc: 'Focus Collaborators Panel' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="w-full max-w-xl rounded-xl shadow-2xl border flex flex-col overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Header */}
        <div 
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold text-white">Keyboard Shortcuts Reference</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5">
          {shortcutSections.map((section) => (
            <div key={section.category}>
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-sky-400 mb-2">
                {section.category}
              </h4>
              <div className="rounded-lg border border-white/5 divide-y divide-white/5 overflow-hidden">
                {section.shortcuts.map((sc, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-black/20 hover:bg-white/[0.02]">
                    <span className="text-neutral-300 text-[11.5px]">{sc.desc}</span>
                    <div className="flex items-center gap-1 font-mono">
                      {sc.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 text-[11px] shadow-sm font-semibold">
                            {k}
                          </kbd>
                          {ki < sc.keys.length - 1 && <span className="text-neutral-500 text-[10px]">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
