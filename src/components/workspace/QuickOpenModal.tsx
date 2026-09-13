'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FileItem } from '@/lib/types';
import { FileIcon } from './FileIcon';
import { Search } from 'lucide-react';

interface QuickOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  onSelectFile: (file: FileItem) => void;
}

export function QuickOpenModal({
  isOpen,
  onClose,
  files,
  onSelectFile,
}: QuickOpenModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const codeFiles = files.filter((f) => !f.is_folder);

  const filtered = codeFiles.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectFile(filtered[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl overflow-hidden text-[#cccccc]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[#3c3c3c] bg-[#1e1e1e]">
          <Search className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Go to file (Ctrl+P)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-neutral-500"
          />
          <kbd className="text-[10px] bg-[#333333] text-neutral-400 px-1.5 py-0.5 rounded border border-[#444444]">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500">
              No files found matching "{query}"
            </div>
          ) : (
            filtered.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={file.id}
                  onClick={() => {
                    onSelectFile(file);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    isSelected ? 'bg-sky-600 text-white font-medium' : 'text-neutral-300 hover:bg-[#2e2e2e]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileIcon name={file.name} isFolder={false} className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-white/20 text-white' : 'text-neutral-500'
                  }`}>
                    {file.language}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
