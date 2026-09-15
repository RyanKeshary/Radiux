'use client';

import React from 'react';
import { FileItem } from '@/lib/types';
import { FileIcon } from './FileIcon';
import { ChevronRight, Folder } from 'lucide-react';

interface BreadcrumbsProps {
  file: FileItem | null;
  allFiles: FileItem[];
  onSelectFolder?: (folderId: string) => void;
}

export function Breadcrumbs({ file, allFiles, onSelectFolder }: BreadcrumbsProps) {
  if (!file) return null;

  // Build ancestral chain from file up to root
  const breadcrumbs: { id: string; name: string; isFolder: boolean }[] = [
    { id: file.id, name: file.name, isFolder: file.is_folder }
  ];

  let currentParentId = file.parent_id;
  while (currentParentId) {
    const parent = allFiles.find((f) => f.id === currentParentId);
    if (parent) {
      breadcrumbs.unshift({ id: parent.id, name: parent.name, isFolder: true });
      currentParentId = parent.parent_id;
    } else {
      break;
    }
  }

  return (
    <div 
      className="h-6 px-3 flex items-center gap-1 text-[11px] select-none border-b overflow-x-auto no-scrollbar font-mono"
      style={{
        backgroundColor: 'var(--ide-bg)',
        borderColor: 'var(--ide-border)',
        color: 'var(--ide-text-muted)',
      }}
      aria-label="File Breadcrumbs"
    >
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={crumb.id}>
            <div 
              onClick={() => crumb.isFolder && onSelectFolder && onSelectFolder(crumb.id)}
              className="flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                color: isLast ? 'var(--ide-text)' : 'var(--ide-text-muted)',
                fontWeight: isLast ? 600 : 400,
              }}
            >
              {crumb.isFolder ? (
                <Folder className="w-3 h-3 text-sky-400" />
              ) : (
                <FileIcon name={crumb.name} isFolder={false} className="w-3 h-3" />
              )}
              <span className="truncate max-w-[120px]">{crumb.name}</span>
            </div>

            {!isLast && (
              <ChevronRight className="w-3 h-3 text-neutral-600 flex-shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
