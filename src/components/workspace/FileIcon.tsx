'use client';

import React from 'react';

interface FileIconProps {
  name: string;
  isFolder: boolean;
  isOpen?: boolean;
  className?: string;
}

export function FileIcon({ name, isFolder, isOpen = false, className = "w-4 h-4" }: FileIconProps) {
  const lowerName = name.toLowerCase();

  // 1. Specialized & General Folders
  if (isFolder) {
    if (lowerName === 'src' || lowerName === 'app') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7H11L9 4H5C3.89543 4 3 4.89543 3 6V7Z" fill="#0284c7" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M9.5 13L7.5 15L9.5 17" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14.5 13L16.5 15L14.5 17" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (lowerName === 'components') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7H11L9 4H5C3.89543 4 3 4.89543 3 6V7Z" fill="#6366f1" fillOpacity="0.2" stroke="#818cf8" strokeWidth="1.6" strokeLinejoin="round"/>
          <rect x="8.5" y="11.5" width="3" height="3" rx="0.5" stroke="#818cf8" strokeWidth="1.2"/>
          <rect x="12.5" y="11.5" width="3" height="3" rx="0.5" stroke="#818cf8" strokeWidth="1.2"/>
          <rect x="10.5" y="15" width="3" height="3" rx="0.5" stroke="#818cf8" strokeWidth="1.2"/>
        </svg>
      );
    }
    if (lowerName === 'public' || lowerName === 'assets' || lowerName === 'static') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7H11L9 4H5C3.89543 4 3 4.89543 3 6V7Z" fill="#10b981" fillOpacity="0.2" stroke="#34d399" strokeWidth="1.6" strokeLinejoin="round"/>
          <circle cx="12" cy="14" r="3" stroke="#34d399" strokeWidth="1.3"/>
          <path d="M9.5 14H14.5M12 11.5V16.5" stroke="#34d399" strokeWidth="1.1"/>
        </svg>
      );
    }
    if (lowerName === 'server' || lowerName === 'api' || lowerName === 'backend') {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7H11L9 4H5C3.89543 4 3 4.89543 3 6V7Z" fill="#f59e0b" fillOpacity="0.2" stroke="#fbbf24" strokeWidth="1.6" strokeLinejoin="round"/>
          <rect x="8" y="12" width="8" height="2" rx="0.5" stroke="#fbbf24" strokeWidth="1"/>
          <rect x="8" y="15.5" width="8" height="2" rx="0.5" stroke="#fbbf24" strokeWidth="1"/>
        </svg>
      );
    }

    if (isOpen) {
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 7V19C3 19.5523 3.44772 20 4 20H19C19.5523 20 20 19.5523 20 19V9C20 8.44772 19.5523 8 19 8H11.5L9.5 5H4C3.44772 5 3 5.44772 3 6V7Z" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M3 10L5.5 20H21.5L19 10H3Z" fill="#38bdf8" fillOpacity="0.35" stroke="#0ea5e9" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      );
    }

    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7H11L9 4H5C3.89543 4 3 4.89543 3 6V7Z" fill="#0284c7" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="1.6" strokeLinejoin="round"/>
      </svg>
    );
  }

  // 2. Specific Exact Files
  if (lowerName === '.gitignore' || lowerName === '.gitattributes') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 6a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM5 18a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" stroke="#f97316" strokeWidth="1.6"/>
        <path d="M8 9v6M8 9a9 9 0 0 0 8 3" stroke="#f97316" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
  }
  if (lowerName.startsWith('.env')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="9" width="16" height="12" rx="2" fill="#eab308" fillOpacity="0.2" stroke="#facc15" strokeWidth="1.6"/>
        <circle cx="12" cy="14" r="1.5" fill="#facc15"/>
        <path d="M8 9V6a4 4 0 0 1 8 0v3" stroke="#facc15" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    );
  }

  // 3. Extensions
  const ext = lowerName.split('.').pop() || '';

  switch (ext) {
    // HTML
    case 'html':
    case 'htm':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 3L5.5 19.5L12 21.5L18.5 19.5L20 3H4Z" fill="#e44d26" fillOpacity="0.15" stroke="#f97316" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M9 9L6.5 12L9 15M15 9L17.5 12L15 15M13.5 8L10.5 16" stroke="#ea580c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );

    // CSS, SCSS, SASS, LESS
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 3L5.5 19.5L12 21.5L18.5 19.5L20 3H4Z" fill="#0284c7" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M9 10C8.5 10 7.5 10.5 7.5 12C7.5 13.5 8.5 14 9 14M15 10C15.5 10 16.5 10.5 16.5 12C16.5 13.5 15.5 14 15 14" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M10 8L8 16M16 8L14 16" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );

    // JavaScript
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="3.5" fill="#f7df1e" fillOpacity="0.2" stroke="#eab308" strokeWidth="1.6"/>
          <path d="M8 12V16.5C8 17.5 7 17.5 6 17" stroke="#eab308" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M13 17C14.5 17.5 16.5 17 16.5 15.5C16.5 13.5 13.5 14 13.5 12.5C13.5 11.5 15 11 16 11.5" stroke="#eab308" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );

    // TypeScript
    case 'ts':
    case 'tsx':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="3.5" fill="#3178c6" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.6"/>
          <path d="M5.5 11H10.5M8 11V17" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M13.5 17C15 17.5 17 17 17 15.5C17 13.5 14 14 14 12.5C14 11.5 15.5 11 16.5 11.5" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );

    // Python
    case 'py':
    case 'pyw':
    case 'ipynb':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.5 3C8 3 8 4.5 8 4.5V7H12.5V8.5H5.5C4 8.5 3 9.5 3 12C3 14.5 4.5 14.5 4.5 14.5H6.5V12.5C6.5 10.5 8 10.5 8 10.5H12.5C14.5 10.5 14.5 9 14.5 9V4.5C14.5 3 11.5 3 11.5 3Z" fill="#38bdf8" fillOpacity="0.25" stroke="#0284c7" strokeWidth="1.3"/>
          <circle cx="6.5" cy="5.5" r="0.75" fill="#0284c7"/>
          <path d="M12.5 21C16 21 16 19.5 16 19.5V17H11.5V15.5H18.5C20 15.5 21 14.5 21 12C21 9.5 19.5 9.5 19.5 9.5H17.5V11.5C17.5 13.5 16 13.5 16 13.5H11.5C9.5 13.5 9.5 15 9.5 15V19.5C9.5 21 12.5 21 12.5 21Z" fill="#facc15" fillOpacity="0.25" stroke="#ca8a04" strokeWidth="1.3"/>
          <circle cx="17.5" cy="18.5" r="0.75" fill="#ca8a04"/>
        </svg>
      );

    // JSON
    case 'json':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 6C6.5 6 6 7 6 8.5V10.5C6 11.5 5 12 4 12C5 12 6 12.5 6 13.5V15.5C6 17 6.5 18 8 18" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M16 6C17.5 6 18 7 18 8.5V10.5C18 11.5 19 12 20 12C19 12 18 12.5 18 13.5V15.5C18 17 17.5 18 16 18" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="1" fill="#f59e0b"/>
        </svg>
      );

    // Images (PNG, JPG, JPEG, WEBP, SVG, GIF, ICO)
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
    case 'svg':
    case 'ico':
    case 'bmp':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="#ec4899" fillOpacity="0.15" stroke="#f43f5e" strokeWidth="1.6"/>
          <circle cx="8.5" cy="9.5" r="1.5" fill="#f43f5e"/>
          <path d="M4.5 17L9 12.5L14 17.5L16.5 15L19.5 18" stroke="#f43f5e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );

    // Video
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'mkv':
    case 'avi':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="5" width="14" height="14" rx="2.5" fill="#8b5cf6" fillOpacity="0.2" stroke="#a855f7" strokeWidth="1.6"/>
          <path d="M17 10L21 7V17L17 14V10Z" fill="#a855f7" stroke="#a855f7" strokeWidth="1.4" strokeLinejoin="round"/>
          <circle cx="10" cy="12" r="2" fill="#a855f7"/>
        </svg>
      );

    // Audio
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
    case 'aac':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="17" r="3" fill="#a855f7" fillOpacity="0.3" stroke="#c084fc" strokeWidth="1.5"/>
          <circle cx="17" cy="14" r="3" fill="#a855f7" fillOpacity="0.3" stroke="#c084fc" strokeWidth="1.5"/>
          <path d="M11 17V8L20 5V14" stroke="#c084fc" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M11 11L20 8" stroke="#c084fc" strokeWidth="1.4"/>
        </svg>
      );

    // Markdown
    case 'md':
    case 'markdown':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="5" width="18" height="14" rx="2.5" fill="#0284c7" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="1.6"/>
          <path d="M6.5 15V9L9 12L11.5 9V15" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 9V15M13.5 12.5L16 15L18.5 12.5" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );

    // Documents / Text
    case 'txt':
    case 'log':
    case 'pdf':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 3H6C4.89543 3 4 3.89543 4 5V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V9L14 3Z" fill="#94a3b8" fillOpacity="0.15" stroke="#94a3b8" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M14 3V9H20" stroke="#94a3b8" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 13H16M8 17H13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );

    // Shell / Bash / Terminal Scripts
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'bat':
    case 'cmd':
    case 'ps1':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="16" rx="3" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.6"/>
          <path d="M7 9L10 12L7 15" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 15H17" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );

    // Default File
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 3H6C4.89543 3 4 3.89543 4 5V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V9L14 3Z" fill="#64748b" fillOpacity="0.1" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M14 3V9H20" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      );
  }
}
