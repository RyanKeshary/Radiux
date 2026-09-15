'use client';

import React from 'react';
import { X, Moon, Sun, Type, Sliders, Check } from 'lucide-react';
import { ThemeId, THEMES } from '@/lib/themes';

export interface EditorSettings {
  theme: ThemeId | 'vs-dark' | 'vs' | 'hc-black';
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
}

interface EditorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
}

export function EditorSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: EditorSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl p-6 text-[#cccccc]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <Sliders className="w-5 h-5 text-sky-400" />
            <span>IDE & Editor Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Theme */}
          <div>
            <label className="block text-neutral-300 font-medium mb-1.5">
              Color Theme
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(THEMES) as ThemeId[]).map((tId) => {
                const t = THEMES[tId];
                const isSelected = settings.theme === tId || (tId === 'dark' && settings.theme === 'vs-dark');
                return (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: tId })}
                    className={`p-2 rounded-lg border text-left font-medium transition-all ${
                      isSelected
                        ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                        : 'bg-[#1e1e1e] border-[#3c3c3c] text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="truncate font-semibold text-[11px] mb-1">{t.name}</div>
                    <div className="flex items-center gap-0.5 h-2 rounded overflow-hidden">
                      <span className="w-1/2 h-full" style={{ backgroundColor: t.colors.bg }} />
                      <span className="w-1/2 h-full" style={{ backgroundColor: t.colors.accent }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between text-neutral-300 font-medium mb-1.5">
              <span>Font Size</span>
              <span className="text-sky-400 font-mono font-bold">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={11}
              max={22}
              value={settings.fontSize}
              onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-sky-500 bg-[#1e1e1e]"
            />
          </div>

          {/* Tab Size */}
          <div>
            <label className="block text-neutral-300 font-medium mb-1.5">
              Tab Size (Spaces)
            </label>
            <div className="flex gap-2">
              {[2, 4].map((size) => (
                <button
                  key={size}
                  onClick={() => onUpdateSettings({ tabSize: size })}
                  className={`flex-1 py-1.5 rounded-lg border text-center font-medium transition-all ${
                    settings.tabSize === size
                      ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                      : 'bg-[#1e1e1e] border-[#3c3c3c] text-neutral-400 hover:text-white'
                  }`}
                >
                  {size} spaces
                </button>
              ))}
            </div>
          </div>

          {/* Word Wrap */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-neutral-300 font-medium">Word Wrap</div>
              <div className="text-[10px] text-neutral-500">Wrap long lines to fit editor viewport</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ wordWrap: settings.wordWrap === 'on' ? 'off' : 'on' })}
              className={`px-3 py-1 rounded font-medium transition-all ${
                settings.wordWrap === 'on'
                  ? 'bg-sky-600 text-white'
                  : 'bg-[#1e1e1e] border border-[#3c3c3c] text-neutral-400'
              }`}
            >
              {settings.wordWrap.toUpperCase()}
            </button>
          </div>

          {/* Minimap */}
          <div className="flex items-center justify-between pt-1 border-t border-[#3c3c3c]">
            <div>
              <div className="text-neutral-300 font-medium">Editor Minimap</div>
              <div className="text-[10px] text-neutral-500">Display code miniature overview on the right</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ minimap: !settings.minimap })}
              className={`px-3 py-1 rounded font-medium transition-all ${
                settings.minimap
                  ? 'bg-sky-600 text-white'
                  : 'bg-[#1e1e1e] border border-[#3c3c3c] text-neutral-400'
              }`}
            >
              {settings.minimap ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
