'use client';

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FolderUp, 
  Github, 
  X, 
  Loader2, 
  FileArchive, 
  FolderPlus, 
  Check, 
  AlertCircle,
  Lock,
  ExternalLink
} from 'lucide-react';
import { DataService } from '@/lib/data-service';
import { UserProfile, Project } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onProjectImported: (project: Project) => void;
}

type ImportTab = 'zip' | 'folder' | 'github';

export function ImportProjectModal({
  isOpen,
  onClose,
  user,
  onProjectImported,
}: ImportProjectModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ImportTab>('zip');
  const [projectName, setProjectName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<FileList | null>(null);
  const [folderCount, setFolderCount] = useState<number>(0);
  
  // GitHub Clone fields
  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFolderFiles(files);
      setFolderCount(files.length);
      if (!projectName && (files[0] as any).webkitRelativePath) {
        const topDir = (files[0] as any).webkitRelativePath.split('/')[0];
        if (topDir) setProjectName(topDir);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let createdProject: Project;

      if (activeTab === 'zip') {
        if (!selectedFile) {
          throw new Error('Please select a .zip archive to import');
        }
        createdProject = await DataService.importProjectFromZip(selectedFile, user, projectName.trim());
      } else if (activeTab === 'folder') {
        if (!selectedFolderFiles || selectedFolderFiles.length === 0) {
          throw new Error('Please select a local folder to import');
        }
        createdProject = await DataService.importProjectFromFolder(selectedFolderFiles, user, projectName.trim());
      } else {
        // GitHub Clone
        if (!githubUrl.trim()) {
          throw new Error('Please enter a GitHub repository URL');
        }
        // Create project first
        const derivedName = projectName.trim() || githubUrl.split('/').pop()?.replace(/\.git$/, '') || 'github-project';
        createdProject = await DataService.createProject(derivedName, `Cloned from ${githubUrl.trim()}`, user);
        
        // Clone into remote workspace disk
        const cloneRes = await DataService.cloneFromGitHub(createdProject.id, githubUrl.trim(), githubToken.trim() || undefined);
        if (!cloneRes.success) {
          throw new Error(cloneRes.stderr || 'Failed to clone repository from GitHub');
        }

        // Fetch cloned files from workspace disk to populate database file tree
        try {
          const filesRes = await fetch(`http://localhost:1234/api/workspace/files?projectId=${createdProject.id}`);
          if (filesRes.ok) {
            const { files } = await filesRes.json();
            if (Array.isArray(files)) {
              // Populate db files
              const createdFolders = new Map<string, string>();
              for (const f of files) {
                if (f.is_folder) {
                  const parts = f.path.split('/');
                  let curPath = '';
                  let pId: string | null = null;
                  for (const p of parts) {
                    curPath = curPath ? `${curPath}/${p}` : p;
                    if (createdFolders.has(curPath)) {
                      pId = createdFolders.get(curPath)!;
                    } else {
                      const nf = await DataService.createFile(createdProject.id, pId, p, true);
                      createdFolders.set(curPath, nf.id);
                      pId = nf.id;
                    }
                  }
                } else {
                  const lastSlash = f.path.lastIndexOf('/');
                  const dir = lastSlash !== -1 ? f.path.substring(0, lastSlash) : '';
                  const pId = dir ? createdFolders.get(dir) || null : null;
                  await DataService.createFile(createdProject.id, pId, f.name, false, f.content || '');
                }
              }
            }
          }
        } catch (e) {
          console.warn('File hydration warning:', e);
        }
      }

      onProjectImported(createdProject);
      onClose();
      router.push(`/workspace/${createdProject.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-neutral-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FolderUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Import Project</h2>
              <p className="text-[11px] text-neutral-400">Import existing project via ZIP, folder, or GitHub clone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#333333] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#333333] bg-[#202020] px-6 pt-2">
          <button
            onClick={() => setActiveTab('zip')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'zip'
                ? 'border-sky-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileArchive className="w-4 h-4 text-sky-400" />
            <span>ZIP Archive</span>
          </button>

          <button
            onClick={() => setActiveTab('folder')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'folder'
                ? 'border-amber-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span>Local Folder</span>
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'github'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Github className="w-4 h-4 text-indigo-400" />
            <span>GitHub Clone</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Name Override */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Project Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. my-awesome-project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#141414] border border-[#3c3c3c] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Tab 1: ZIP Archive Upload */}
          {activeTab === 'zip' && (
            <div className="space-y-3">
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={handleZipSelect}
              />
              <div
                onClick={() => zipInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? 'border-sky-500/50 bg-sky-950/20'
                    : 'border-[#3c3c3c] hover:border-sky-500/50 bg-[#181818]'
                }`}
              >
                <FileArchive className="w-8 h-8 text-sky-400 mx-auto mb-2" />
                {selectedFile ? (
                  <div>
                    <span className="text-xs font-semibold text-white block">{selectedFile.name}</span>
                    <span className="text-[11px] text-neutral-400">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-semibold text-white block">Click to select ZIP archive</span>
                    <span className="text-[11px] text-neutral-500">Supports nested directories, code and binary assets</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Local Project Folder */}
          {activeTab === 'folder' && (
            <div className="space-y-3">
              <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                onChange={handleFolderSelect}
              />
              <div
                onClick={() => folderInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  selectedFolderFiles
                    ? 'border-amber-500/50 bg-amber-950/20'
                    : 'border-[#3c3c3c] hover:border-amber-500/50 bg-[#181818]'
                }`}
              >
                <FolderPlus className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                {selectedFolderFiles ? (
                  <div>
                    <span className="text-xs font-semibold text-white block">{folderCount} files selected</span>
                    <span className="text-[11px] text-neutral-400">Ready to recreate project structure • Click to reselect</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-semibold text-white block">Click to select local folder</span>
                    <span className="text-[11px] text-neutral-500">
                      Uploads complete directory structure without needing a ZIP file
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: GitHub Clone */}
          {activeTab === 'github' && (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">
                  GitHub Repository Clone URL
                </label>
                <input
                  type="text"
                  placeholder="https://github.com/facebook/react.git"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#141414] border border-[#3c3c3c] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-neutral-400" />
                    GitHub Token (Optional for private repos)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-0.5"
                  >
                    Generate Token <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx..."
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full px-3.5 py-1.5 text-xs bg-[#141414] border border-[#3c3c3c] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Submit */}
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
              disabled={loading || (activeTab === 'zip' && !selectedFile) || (activeTab === 'folder' && !selectedFolderFiles) || (activeTab === 'github' && !githubUrl.trim())}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Import & Open Workspace</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
