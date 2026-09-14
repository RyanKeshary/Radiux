'use client';

import React, { useState, useRef } from 'react';
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
  Loader2
} from 'lucide-react';

interface FileTreeProps {
  files: FileItem[];
  activeFileId: string | null;
  onSelectFile: (file: FileItem) => void;
  onCreateFile: (parentId: string | null, name: string, isFolder: boolean) => Promise<void>;
  onRenameFile: (fileId: string, newName: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onUploadFiles?: (parentId: string | null, files: FileList) => Promise<void>;
}

export function FileTree({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onUploadFiles,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFolder = (folderId: string) => {
    setOpenFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleStartRename = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.name);
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

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !onUploadFiles) return;

    setUploading(true);
    try {
      await onUploadFiles(targetUploadParent, selectedFiles);
      if (targetUploadParent) {
        setOpenFolders(prev => ({ ...prev, [targetUploadParent]: true }));
      }
    } catch (err) {
      console.error('Failed to upload files:', err);
    } finally {
      setUploading(false);
      setTargetUploadParent(null);
    }
  };

  // Build recursive tree
  const rootFiles = files.filter(f => f.parent_id === null);

  const renderNode = (item: FileItem, depth: number = 0) => {
    const isFolder = item.is_folder;
    const isOpen = Boolean(openFolders[item.id]);
    const isActive = activeFileId === item.id;
    const children = files.filter(f => f.parent_id === item.id);

    return (
      <div key={item.id} className="select-none">
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(item.id);
            } else {
              onSelectFile(item);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between pr-2 py-1 cursor-pointer text-xs transition-colors rounded-sm ${
            isActive
              ? 'bg-[#094771] text-white font-medium'
              : 'text-[#cccccc] hover:bg-[#2a2d2e] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isFolder && (
              <span className="text-neutral-400">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            )}
            <FileIcon name={item.name} isFolder={isFolder} isOpen={isOpen} className="w-4 h-4 flex-shrink-0" />
            {editingId === item.id ? (
              <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename(item.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="bg-[#1e1e1e] border border-sky-500 rounded px-1 text-xs text-white outline-none w-full"
                />
                <button
                  onClick={() => handleSaveRename(item.id)}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-neutral-400 hover:text-neutral-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="truncate">{item.name}</span>
            )}
          </div>

          {editingId !== item.id && (
            <div className="hidden group-hover:flex items-center gap-0.5 text-neutral-400">
              {isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreatingInParent({ parentId: item.id, isFolder: false });
                      setOpenFolders(prev => ({ ...prev, [item.id]: true }));
                    }}
                    title="New File inside folder"
                    className="p-1 hover:text-white rounded hover:bg-[#383b3d]"
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
                    className="p-1 hover:text-white rounded hover:bg-[#383b3d]"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerUpload(item.id);
                    }}
                    title="Upload Media to this folder"
                    className="p-1 hover:text-sky-300 rounded hover:bg-[#383b3d]"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => handleStartRename(e, item)}
                title="Rename"
                className="p-1 hover:text-white rounded hover:bg-[#383b3d]"
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
                className="p-1 hover:text-rose-400 rounded hover:bg-[#383b3d]"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Render child creation input if active */}
        {creatingInParent?.parentId === item.id && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
            className="flex items-center gap-1.5 pr-2 py-1 bg-[#2a2d2e]"
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
    <div className="flex flex-col h-full bg-[#252526] select-none relative">
      {/* Hidden File Input for Media Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.png,.jpg,.jpeg,.gif,.svg,.webp,.bmp,.ico,.mp4,.webm,.ogg,.mov,.mkv"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Explorer Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333333] text-[11px] font-bold uppercase tracking-wider text-neutral-400">
        <span>Files Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => triggerUpload(null)}
            title="Upload Media (Images & Videos)"
            disabled={uploading}
            className="p-1 hover:text-sky-300 rounded hover:bg-[#333333] transition-colors disabled:opacity-40"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" /> : <Upload className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setCreatingInParent({ parentId: null, isFolder: false })}
            title="New File in Root"
            className="p-1 hover:text-white rounded hover:bg-[#333333] transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCreatingInParent({ parentId: null, isFolder: true })}
            title="New Folder in Root"
            className="p-1 hover:text-white rounded hover:bg-[#333333] transition-colors"
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
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2d2e] border-b border-[#3c3c3c]">
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
    </div>
  );
}
