'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FileItem } from '@/lib/types';
import { FileIcon } from './FileIcon';
import { Search, ChevronRight } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileItem[];
  onSelectFile: (file: FileItem) => void;
}

interface SearchMatch {
  file: FileItem;
  lineNumber: number;
  lineText: string;
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  files,
  onSelectFile,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setMatches([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      return;
    }

    const q = query.toLowerCase();
    const results: SearchMatch[] = [];

    const codeFiles = files.filter((f) => !f.is_folder && f.content);
    for (const file of codeFiles) {
      const lines = (file.content || '').split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(q)) {
          results.push({
            file,
            lineNumber: idx + 1,
            lineText: line.trim(),
          });
        }
      });
    }

    setMatches(results);
  }, [query, files]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl overflow-hidden text-[#cccccc]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[#3c3c3c] bg-[#1e1e1e]">
          <Search className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search across all project files (Ctrl+Shift+F)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-neutral-500"
          />
          <kbd className="text-[10px] bg-[#333333] text-neutral-400 px-1.5 py-0.5 rounded border border-[#444444]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="p-4 text-center text-xs text-neutral-500">
              Type keywords to search across all project file contents.
            </div>
          ) : matches.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500">
              No occurrences found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-neutral-400 px-2 py-1">
                Found {matches.length} matches:
              </div>
              {matches.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectFile(m.file);
                    onClose();
                  }}
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[#2e2e2e] cursor-pointer text-xs transition-colors"
                >
                  <FileIcon name={m.file.name} isFolder={false} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-white font-medium">
                      <span>{m.file.name}</span>
                      <span className="text-[10px] text-sky-400 font-mono">
                        Line {m.lineNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono truncate mt-0.5 bg-[#1e1e1e] px-2 py-0.5 rounded border border-[#333333]">
                      {m.lineText}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500 self-center" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
