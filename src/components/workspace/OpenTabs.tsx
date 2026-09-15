'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileItem } from '@/lib/types';
import { FileIcon } from './FileIcon';
import { 
  X, 
  Circle, 
  SplitSquareVertical, 
  SplitSquareHorizontal, 
  MoreHorizontal,
  Columns2
} from 'lucide-react';

interface CollaboratorFileUser {
  id: string;
  name: string;
  color: string;
}

interface OpenTabsProps {
  openFiles: FileItem[];
  activeFileId: string | null;
  onSelectTab: (file: FileItem) => void;
  onCloseTab: (fileId: string) => void;
  onCloseOthers?: (fileId: string) => void;
  onCloseToRight?: (fileId: string) => void;
  onCloseAll?: () => void;
  onSplitRight?: () => void;
  onSplitDown?: () => void;
  onCloseGroup?: () => void;
  collaboratorsByFile?: Record<string, CollaboratorFileUser[]>;
  dirtyFileIds?: Set<string>;
  canCloseGroup?: boolean;
}

export function OpenTabs({
  openFiles,
  activeFileId,
  onSelectTab,
  onCloseTab,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onSplitRight,
  onSplitDown,
  onCloseGroup,
  collaboratorsByFile = {},
  dirtyFileIds = new Set(),
  canCloseGroup = false,
}: OpenTabsProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    fileId: string;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  if (openFiles.length === 0) return null;

  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      fileId,
    });
  };

  return (
    <div 
      className="flex items-center justify-between border-b select-none h-9 relative"
      style={{
        backgroundColor: 'var(--ide-dock-header)',
        borderColor: 'var(--ide-border)',
      }}
    >
      {/* Scrollable Tab Strip */}
      <div className="flex items-center overflow-x-auto no-scrollbar h-full flex-1 min-w-0">
        {openFiles.map((file, index) => {
          const isActive = activeFileId === file.id;
          const isDirty = dirtyFileIds.has(file.id);
          const peersOnThisFile = collaboratorsByFile[file.id] || [];

          return (
            <div
              key={file.id}
              onClick={() => onSelectTab(file)}
              onContextMenu={(e) => handleContextMenu(e, file.id)}
              className={`group flex items-center gap-2 px-3 h-full text-xs cursor-pointer border-r transition-colors min-w-[120px] max-w-[210px] relative ${
                isActive
                  ? 'font-semibold border-t-2'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--ide-bg)' : 'var(--ide-tab-inactive)',
                borderColor: 'var(--ide-border)',
                borderTopColor: isActive ? 'var(--ide-accent)' : undefined,
                color: isActive ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              }}
              title={file.name}
            >
              <FileIcon name={file.name} isFolder={false} className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate flex-1 font-mono text-[11.5px]">{file.name}</span>

              {/* Collaborator Peer Dots on Tab */}
              {peersOnThisFile.length > 0 && (
                <div className="flex items-center -space-x-1 flex-shrink-0" title={`Collaborators on this file: ${peersOnThisFile.map(p => p.name).join(', ')}`}>
                  {peersOnThisFile.slice(0, 3).map((peer) => (
                    <div
                      key={peer.id}
                      className="w-3 h-3 rounded-full border border-[#1e1e1e] flex items-center justify-center text-[7px] font-bold text-white uppercase"
                      style={{ backgroundColor: peer.color }}
                    >
                      {peer.name.charAt(0)}
                    </div>
                  ))}
                  {peersOnThisFile.length > 3 && (
                    <span className="text-[8px] text-neutral-400 font-bold ml-1">+{peersOnThisFile.length - 3}</span>
                  )}
                </div>
              )}

              {/* Dirty Indicator / Close Tab Button */}
              <div className="flex items-center flex-shrink-0">
                {isDirty ? (
                  <Circle className="w-2 h-2 fill-current text-sky-400 group-hover:hidden" />
                ) : null}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(file.id);
                  }}
                  className={`p-0.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-opacity ${
                    isDirty ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Close (Ctrl+W)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Split & Group Control Actions */}
      <div className="flex items-center gap-0.5 px-2 flex-shrink-0 text-neutral-400">
        {onSplitRight && (
          <button
            onClick={onSplitRight}
            className="p-1 rounded hover:text-white hover:bg-white/10 transition-colors"
            title="Split Editor Right (Ctrl+\)"
            aria-label="Split Editor Right"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {onSplitDown && (
          <button
            onClick={onSplitDown}
            className="p-1 rounded hover:text-white hover:bg-white/10 transition-colors"
            title="Split Editor Down"
            aria-label="Split Editor Down"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
          </button>
        )}

        {canCloseGroup && onCloseGroup && (
          <button
            onClick={onCloseGroup}
            className="p-1 rounded hover:text-white hover:bg-white/10 transition-colors text-neutral-400"
            title="Close Split Group"
            aria-label="Close Split Group"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text)',
          }}
          className="fixed z-50 py-1 rounded shadow-2xl border text-xs min-w-[160px] animate-in fade-in zoom-in-95 duration-75"
        >
          <div>
            <button
              onClick={() => {
                onCloseTab(contextMenu.fileId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between"
            >
              <span>Close</span>
              <span className="text-[10px] opacity-60">Ctrl+W</span>
            </button>

            {onCloseOthers && (
              <button
                onClick={() => {
                  onCloseOthers(contextMenu.fileId);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white"
              >
                Close Others
              </button>
            )}

            {onCloseToRight && (
              <button
                onClick={() => {
                  onCloseToRight(contextMenu.fileId);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white"
              >
                Close to the Right
              </button>
            )}

            {onCloseAll && (
              <button
                onClick={() => {
                  onCloseAll();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white border-t border-[#3c3c3c] mt-1 pt-1.5"
              >
                Close All
              </button>
            )}

            {onSplitRight && (
              <button
                onClick={() => {
                  onSplitRight();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white border-t border-[#3c3c3c] mt-1 pt-1.5 flex items-center justify-between"
              >
                <span>Split Right</span>
                <span className="text-[10px] opacity-60">Ctrl+\</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
