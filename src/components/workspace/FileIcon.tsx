'use client';

import React from 'react';
import { 
  FileCode, 
  FileJson, 
  FileText, 
  FileCode2, 
  FileSpreadsheet, 
  Folder, 
  FolderOpen 
} from 'lucide-react';
import { LanguageType } from '@/lib/types';

interface FileIconProps {
  name: string;
  isFolder: boolean;
  isOpen?: boolean;
  className?: string;
}

export function FileIcon({ name, isFolder, isOpen = false, className = "w-4 h-4" }: FileIconProps) {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen className={`${className} text-sky-400 fill-sky-400/20`} />
    ) : (
      <Folder className={`${className} text-sky-400 fill-sky-400/10`} />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
      return <FileCode className={`${className} text-amber-400`} />;
    case 'ts':
    case 'tsx':
      return <FileCode className={`${className} text-blue-400`} />;
    case 'py':
      return <FileCode2 className={`${className} text-emerald-400`} />;
    case 'html':
      return <FileCode className={`${className} text-orange-500`} />;
    case 'css':
    case 'scss':
      return <FileCode className={`${className} text-teal-400`} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
    case 'bmp':
      return <FileSpreadsheet className={`${className} text-rose-400`} />;
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'ogg':
      return <FileText className={`${className} text-purple-400`} />;
    case 'json':
      return <FileJson className={`${className} text-yellow-300`} />;
    case 'md':
      return <FileText className={`${className} text-sky-300`} />;
    default:
      return <FileText className={`${className} text-neutral-400`} />;
  }
}
