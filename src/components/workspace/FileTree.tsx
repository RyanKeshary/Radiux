'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileItem } from '@/lib/types';
import { FileIcon } from './FileIcon';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  FolderPlus, 
  FilePlus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  Upload,
  Loader2,
  Copy
} from 'lucide-react';

interface CollaboratorPeer {
  id: string;
  name: string;
  color: string;
}

interface FileTreeProps {
  files: FileItem[];
  activeFileId: string | null;
  onSelectFile: (file: FileItem) => void;
  onCreateFile: (parentId: string | null, name: string, isFolder: boolean) => Promise<void>;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onUploadFiles?: (parentId: string | null, files: FileList) => Promise<void>;
  onUploadFolder?: (parentId: string | null, files: FileList) => Promise<void>;
  collaboratorsByFile?: Record<string, CollaboratorPeer[]>;
}

export function FileTree({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onUploadFiles,
  onUploadFolder,
  collaboratorsByFile = {},
}: FileTreeProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'folder-src': true // default open common folder if present
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creatingInParent, setCreatingInParent] = useState<{ parentId: string | null; isFolder: boolean } | null>(null);
  const [createName, setCreateName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [targetUploadParent, setTargetUploadParent] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileItem | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss context menu on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const toggleFolder = (folderId: string) => {
    setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleStartRename = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.name);
    setContextMenu(null);
  };

  const handleSaveRename = async (fileId: string) => {
    if (editName.trim()) {
      await onRenameFile(fileId, editName.trim());
    }
    setEditingId(null);
  };

  const handleSaveCreate = async () => {
    if (creatingInParent && createName.trim()) {
      await onCreateFile(creatingInParent.parentId, createName.trim(), creatingInParent.isFolder);
      if (creatingInParent.parentId) {
        setOpenFolders(prev => ({ ...prev, [creatingInParent.parentId!]: true }));
      }
    }
    setCreatingInParent(null);
    setCreateName('');
  };

  const triggerUpload = (parentId: string | null) => {
    setTargetUploadParent(parentId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const triggerUploadFolder = (parentId: string | null) => {
    setTargetUploadParent(parentId);
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
      folderInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !onUploadFiles) return;
    try {
      setUploading(true);
      await onUploadFiles(targetUploadParent, fileList);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
      setTargetUploadParent(null);
    }
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !onUploadFolder) return;
    try {
      setUploading(true);
      await onUploadFolder(targetUploadParent, fileList);
    } catch (err) {
      console.error('Folder upload failed:', err);
    } finally {
      setUploading(false);
      setTargetUploadParent(null);
    }
  };

  // Build tree structure
  const fileMap = new Map<string, FileItem & { children: FileItem[] }>();
  const rootFiles: (FileItem & { children: FileItem[] })[] = [];

  files.forEach(file => {
    fileMap.set(file.id, { ...file, children: [] });
  });

  files.forEach(file => {
    const item = fileMap.get(file.id)!;
    if (file.parent_id && fileMap.has(file.parent_id)) {
      fileMap.get(file.parent_id)!.children.push(item);
    } else {
      rootFiles.push(item);
    }
  });

  const sortItems = (items: FileItem[]) => {
    return [...items].sort((a, b) => {
      if (a.is_folder && !b.is_folder) return -1;
      if (!a.is_folder && b.is_folder) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  const renderNode = (item: FileItem, depth = 0) => {
    const isFolder = item.is_folder;
    const isOpen = !!openFolders[item.id];
    const isActive = activeFileId === item.id;
    const children = sortItems(item.children || []);
    const peersOnThisFile = !isFolder ? (collaboratorsByFile[item.id] || []) : [];

    return (
      <div key={item.id} className="text-xs select-none">
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(item.id);
            } else {
              onSelectFile(item);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, item)}
          style={{ paddingLeft: `${depth * 12 + 10}px` }}
          className={`group flex items-center justify-between pr-2 py-1 cursor-pointer transition-colors ${
            isActive
              ? 'bg-sky-500/15 text-white font-medium border-l-2 border-sky-400'
              : 'text-neutral-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0 pr-1">
            {isFolder ? (
              <span className="text-neutral-500 flex-shrink-0">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}

            <FileIcon name={item.name} isFolder={isFolder} isOpen={isOpen} className="w-4 h-4 flex-shrink-0" />

            {editingId === item.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename(item.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="bg-[#1e1e1e] border border-sky-500 rounded px-1 py-0.2 text-xs text-white outline-none w-full"
                />
                <button onClick={() => handleSaveRename(item.id)} className="text-emerald-400 hover:text-emerald-300 p-0.5">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setEditingId(null)} className="text-neutral-400 hover:text-neutral-300 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="truncate font-mono text-[11.5px]">{item.name}</span>
            )}
          </div>

          {/* Collaborator Presence Dots */}
          {peersOnThisFile.length > 0 && (
            <div className="flex items-center -space-x-1 flex-shrink-0 mr-1" title={`Editing: ${peersOnThisFile.map(p => p.name).join(', ')}`}>
              {peersOnThisFile.slice(0, 3).map((peer) => (
                <span
                  key={peer.id}
                  className="w-2.5 h-2.5 rounded-full border border-black/50"
                  style={{ backgroundColor: peer.color }}
                />
              ))}
            </div>
          )}

          {/* Inline Action Buttons */}
          {editingId !== item.id && (
            <div className="hidden group-hover:flex items-center gap-0.5 text-neutral-400 flex-shrink-0">
              {isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreatingInParent({ parentId: item.id, isFolder: false });
                      setOpenFolders(prev => ({ ...prev, [item.id]: true }));
                    }}
                    title="New File inside folder"
                    className="p-1 hover:text-white rounded hover:bg-white/10"
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreatingInParent({ parentId: item.id, isFolder: true });
                      setOpenFolders(prev => ({ ...prev, [item.id]: true }));
                    }}
                    title="New Subfolder"
                    className="p-1 hover:text-white rounded hover:bg-white/10"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerUpload(item.id);
                    }}
                    title="Upload Media to this folder"
                    className="p-1 hover:text-sky-300 rounded hover:bg-white/10"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => handleStartRename(e, item)}
                title="Rename"
                className="p-1 hover:text-white rounded hover:bg-white/10"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete ${item.name}?`)) {
                    await onDeleteFile(item.id);
                  }
                }}
                title="Delete"
                className="p-1 hover:text-rose-400 rounded hover:bg-white/10"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Render child creation input if active */}
        {creatingInParent?.parentId === item.id && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 12 + 10}px` }}
            className="flex items-center gap-1.5 pr-2 py-1 bg-white/[0.04]"
          >
            <FileIcon name={createName} isFolder={creatingInParent.isFolder} className="w-4 h-4 flex-shrink-0" />
            <input
              type="text"
              placeholder={creatingInParent.isFolder ? "Folder name..." : "file.js..."}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCreate();
                if (e.key === 'Escape') setCreatingInParent(null);
              }}
              autoFocus
              className="bg-[#1e1e1e] border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white outline-none flex-1"
            />
            <button onClick={handleSaveCreate} className="text-emerald-400 hover:text-emerald-300 p-0.5">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setCreatingInParent(null)} className="text-neutral-400 hover:text-neutral-300 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Render children */}
        {isFolder && isOpen && (
          <div>
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col h-full select-none relative"
      style={{
        backgroundColor: 'var(--ide-sidebar)',
        color: 'var(--ide-text)',
      }}
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      {/* Hidden File Input for Media / File Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Hidden Folder Input for Uploading Whole Directory */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleFolderInputChange}
      />

      {/* Explorer Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex-shrink-0"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        <span>Files Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => triggerUpload(null)}
            title="Upload Files"
            disabled={uploading}
            className="p-1 hover:text-sky-300 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" /> : <Upload className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => triggerUploadFolder(null)}
            title="Upload Complete Folder"
            disabled={uploading}
            className="p-1 hover:text-amber-300 rounded hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
          </button>
          <button
            onClick={() => setCreatingInParent({ parentId: null, isFolder: false })}
            title="New File in Root"
            className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCreatingInParent({ parentId: null, isFolder: true })}
            title="New Folder in Root"
            className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Uploading Banner */}
      {uploading && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-950/70 border-b border-sky-800 text-[11px] text-sky-200">
          <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
          <span>Uploading media to database & workspace...</span>
        </div>
      )}

      {/* Root creation input */}
      {creatingInParent?.parentId === null && (
        <div 
          className="flex items-center gap-1.5 px-3 py-1.5 border-b"
          style={{ backgroundColor: 'var(--ide-bg)', borderColor: 'var(--ide-border)' }}
        >
          <FileIcon name={createName} isFolder={creatingInParent.isFolder} className="w-4 h-4 flex-shrink-0" />
          <input
            type="text"
            placeholder={creatingInParent.isFolder ? "Folder name..." : "file.js..."}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveCreate();
              if (e.key === 'Escape') setCreatingInParent(null);
            }}
            autoFocus
            className="bg-black/30 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white outline-none flex-1"
          />
          <button onClick={handleSaveCreate} className="text-emerald-400 hover:text-emerald-300 p-0.5">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCreatingInParent(null)} className="text-neutral-400 hover:text-neutral-300 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-500">
            No files in project. Click + or Upload above to get started.
          </div>
        ) : (
          rootFiles.map(f => renderNode(f, 0))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 py-1 rounded shadow-2xl border text-xs min-w-[170px] bg-[#252526] border-[#3c3c3c] text-neutral-200"
        >
          <button
            onClick={() => {
              setCreatingInParent({ 
                parentId: contextMenu.item?.is_folder ? contextMenu.item.id : (contextMenu.item?.parent_id || null), 
                isFolder: false 
              });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center gap-2"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>New File</span>
          </button>

          <button
            onClick={() => {
              setCreatingInParent({ 
                parentId: contextMenu.item?.is_folder ? contextMenu.item.id : (contextMenu.item?.parent_id || null), 
                isFolder: true 
              });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center gap-2"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Folder</span>
          </button>

          {contextMenu.item && (
            <>
              <div className="h-px bg-neutral-700 my-1" />

              <button
                onClick={(e) => {
                  if (contextMenu.item) {
                    setEditingId(contextMenu.item.id);
                    setEditName(contextMenu.item.name);
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Rename</span>
              </button>

              <button
                onClick={() => {
                  if (contextMenu.item) {
                    navigator.clipboard.writeText(contextMenu.item.name);
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy File Name</span>
              </button>

              <div className="h-px bg-neutral-700 my-1" />

              <button
                onClick={async () => {
                  if (contextMenu.item && confirm(`Delete ${contextMenu.item.name}?`)) {
                    await onDeleteFile(contextMenu.item.id);
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-600 hover:text-white flex items-center gap-2 text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
