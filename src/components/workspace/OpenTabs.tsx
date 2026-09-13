'use client';

import React from 'react';
import { FileItem } from '@/lib/types';
import { FileIcon } from './FileIcon';
import { X, Circle } from 'lucide-react';

interface OpenTabsProps {
  openFiles: FileItem[];
  activeFileId: string | null;
  onSelectTab: (file: FileItem) => void;
  onCloseTab: (fileId: string) => void;
}

export function OpenTabs({
  openFiles,
  activeFileId,
  onSelectTab,
  onCloseTab,
}: OpenTabsProps) {
  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto select-none no-scrollbar h-9">
      {openFiles.map((file) => {
        const isActive = activeFileId === file.id;
        return (
          <div
            key={file.id}
            onClick={() => onSelectTab(file)}
            className={`group flex items-center gap-2 px-3.5 h-full text-xs cursor-pointer border-r border-[#3c3c3c] transition-colors min-w-[120px] max-w-[200px] ${
              isActive
                ? 'bg-[#1e1e1e] text-white border-t-2 border-t-sky-500 font-medium'
                : 'bg-[#2d2d2d] text-neutral-400 hover:bg-[#282828] hover:text-neutral-200'
            }`}
          >
            <FileIcon name={file.name} isFolder={false} className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate flex-1">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(file.id);
              }}
              className="p-0.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-700/60 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
