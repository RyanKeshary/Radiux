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
        style={{
          backgroundColor: 'var(--ide-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="w-full max-w-xl border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
          className="flex items-center gap-2 px-3.5 py-2.5 border-b"
        >
          <Search className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search across all project files (Ctrl+Shift+F)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            style={{ color: 'var(--ide-text)' }}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50"
          />
          <kbd
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text-muted)',
            }}
            className="text-[10px] px-1.5 py-0.5 rounded border"
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--ide-text-muted)' }}>
              Type keywords to search across all project file contents.
            </div>
          ) : matches.length === 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--ide-text-muted)' }}>
              No occurrences found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold px-2 py-1" style={{ color: 'var(--ide-text-muted)' }}>
                Found {matches.length} matches:
              </div>
              {matches.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectFile(m.file);
                    onClose();
                  }}
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:opacity-80 cursor-pointer text-xs transition-colors"
                >
                  <FileIcon name={m.file.name} isFolder={false} className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium" style={{ color: 'var(--ide-text)' }}>
                      <span>{m.file.name}</span>
                      <span className="text-[10px] text-sky-400 font-mono">
                        Line {m.lineNumber}
                      </span>
                    </div>
                    <div
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text-muted)',
                      }}
                      className="text-[11px] font-mono truncate mt-0.5 px-2 py-0.5 rounded border"
                    >
                      {m.lineText}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 self-center" style={{ color: 'var(--ide-text-muted)' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
