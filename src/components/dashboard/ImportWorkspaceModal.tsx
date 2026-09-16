'use client';

import React, { useState, useRef } from 'react';
import { 
  FolderArchive, 
  X, 
  Loader2, 
  Check, 
  AlertCircle, 
  ShieldCheck,
  FileArchive
} from 'lucide-react';
import { DataService } from '@/lib/data-service';
import { UserProfile } from '@/lib/types';

interface ImportWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSuccess: () => void;
}

export function ImportWorkspaceModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: ImportWorkspaceModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    try {
      const { importedCount } = await DataService.importCompleteWorkspace(selectedFile, user);
      setResultMessage(`Successfully imported ${importedCount} project(s) into your Radiux workspace.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to import workspace archive');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Import Complete Workspace</h2>
              <p className="text-[11px] text-neutral-400">Restore multiple projects from backup archive</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#333333] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleImport} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resultMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{resultMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={handleFileChange}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-purple-500/50 bg-purple-950/20'
                  : 'border-[#3c3c3c] hover:border-purple-500/50 bg-[#181818]'
              }`}
            >
              <FileArchive className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              {selectedFile ? (
                <div>
                  <span className="text-xs font-semibold text-white block">{selectedFile.name}</span>
                  <span className="text-[11px] text-neutral-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to restore
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-semibold text-white block">Click to select workspace archive (.zip)</span>
                  <span className="text-[11px] text-neutral-500">Contains workspace.json and project folders</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#252526] border border-[#333333] flex items-start gap-2.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              Workspace import safely restores project directories and metadata without overwriting existing projects or importing sensitive tokens.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-neutral-400 hover:text-white rounded-xl hover:bg-[#282828] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Restore Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
