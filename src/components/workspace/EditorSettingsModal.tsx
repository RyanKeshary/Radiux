'use client';

import React from 'react';
import { X, Moon, Sun, Type, Sliders, Check } from 'lucide-react';

export interface EditorSettings {
  theme: 'vs-dark' | 'vs' | 'hc-black';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl p-6 text-[#cccccc]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#3c3c3c]">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <Sliders className="w-5 h-5 text-sky-400" />
            <span>Editor Settings</span>
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
              Editor Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'vs-dark', label: 'Dark (VS Code)' },
                { id: 'vs', label: 'Light' },
                { id: 'hc-black', label: 'High Contrast' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => onUpdateSettings({ theme: t.id as any })}
                  className={`p-2 rounded-lg border text-center font-medium transition-all ${
                    settings.theme === t.id
                      ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                      : 'bg-[#1e1e1e] border-[#3c3c3c] text-neutral-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
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
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.wordWrap === 'on' ? 'bg-sky-600' : 'bg-[#3c3c3c]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.wordWrap === 'on' ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Minimap */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-neutral-300 font-medium">Editor Minimap</div>
              <div className="text-[10px] text-neutral-500">Show miniature overview on the right</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ minimap: !settings.minimap })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                settings.minimap ? 'bg-sky-600' : 'bg-[#3c3c3c]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  settings.minimap ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-[#3c3c3c] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
