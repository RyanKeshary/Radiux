'use client';

import React, { useState } from 'react';
import { FileItem, isMediaFile } from '@/lib/types';
import { buildApiUrl } from '@/lib/config';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  RotateCw,
  Download, 
  Film, 
  Image as ImageIcon,
  Music,
  FileText
} from 'lucide-react';

interface MediaViewerProps {
  file: FileItem;
  projectId: string;
}

export function MediaViewer({ file, projectId }: MediaViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const mediaInfo = isMediaFile(file.name);
  
  const isImage = mediaInfo.type === 'image' || file.media_type === 'image';
  const isVideo = mediaInfo.type === 'video' || file.media_type === 'video';
  const isAudio = mediaInfo.type === 'audio' || file.media_type === 'audio';
  const isOther = !isImage && !isVideo && !isAudio;

  const srcUrl = file.content?.startsWith('data:') || file.content?.startsWith('http') || file.content?.startsWith('/')
    ? file.content
    : buildApiUrl(`/preview/${projectId}/${encodeURIComponent(file.name)}`);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = srcUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--ide-bg)',
        color: 'var(--ide-text)',
      }}
      className="flex flex-col h-full w-full overflow-hidden select-none"
    >
      {/* Top Toolbar */}
      <div
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="flex items-center justify-between px-4 py-2 border-b text-xs"
      >
        <div className="flex items-center gap-2">
          {isImage && <ImageIcon className="w-4 h-4 text-rose-400" />}
          {isVideo && <Film className="w-4 h-4 text-purple-400" />}
          {isAudio && <Music className="w-4 h-4 text-amber-400" />}
          {isOther && <FileText className="w-4 h-4 text-sky-400" />}
          <span className="font-semibold truncate max-w-xs" style={{ color: 'var(--ide-text)' }}>{file.name}</span>
          <span
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text-muted)',
            }}
            className="text-[10px] px-1.5 py-0.5 rounded border uppercase font-mono"
          >
            {file.name.split('.').pop() || 'FILE'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isImage && (
            <div
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 border"
            >
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                title="Zoom Out"
                className="p-1 hover:opacity-80 disabled:opacity-30 rounded"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1 min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                title="Zoom In"
                className="p-1 hover:opacity-80 disabled:opacity-30 rounded"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRotate}
                title="Rotate 90°"
                className="p-1 hover:opacity-80 rounded"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                title="Reset View"
                className="p-1 hover:opacity-80 rounded ml-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleDownload}
            title="Download Media File"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors border hover:opacity-90"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Media Canvas / Preview Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
        {isImage && (
          <div 
            className="transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full"
            style={{ 
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center'
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={srcUrl}
              alt={file.name}
              style={{ borderColor: 'var(--ide-border)' }}
              className="max-h-[75vh] max-w-[85vw] object-contain rounded shadow-2xl border"
            />
          </div>
        )}

        {isVideo && (
          <div className="max-w-4xl w-full flex flex-col items-center justify-center">
            <video
              controls
              autoPlay
              playsInline
              src={srcUrl}
              style={{ borderColor: 'var(--ide-border)' }}
              className="max-h-[75vh] w-full rounded-lg shadow-2xl border bg-black"
            >
              Your browser does not support the video tag.
            </video>
            <div className="mt-3 text-xs font-mono" style={{ color: 'var(--ide-text-muted)' }}>
              Video Player &bull; HTML5 Compatible
            </div>
          </div>
        )}

        {isAudio && (
          <div
            style={{
              backgroundColor: 'var(--ide-card-bg)',
              borderColor: 'var(--ide-border)',
            }}
            className="max-w-md w-full p-6 rounded-2xl border shadow-2xl flex flex-col items-center gap-5"
          >
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Music className="w-10 h-10 animate-pulse" />
            </div>
            <div className="text-center w-full">
              <h3 className="font-semibold text-base truncate" style={{ color: 'var(--ide-text)' }}>{file.name}</h3>
              <p className="text-xs mt-1 font-mono uppercase" style={{ color: 'var(--ide-text-muted)' }}>Audio Playback</p>
            </div>
            <audio
              controls
              autoPlay
              src={srcUrl}
              className="w-full mt-2"
            />
          </div>
        )}

        {isOther && (
          <div
            style={{
              backgroundColor: 'var(--ide-card-bg)',
              borderColor: 'var(--ide-border)',
            }}
            className="max-w-sm w-full p-6 rounded-xl border shadow-xl flex flex-col items-center text-center gap-4"
          >
            <div className="w-16 h-16 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <p className="font-medium text-sm break-all" style={{ color: 'var(--ide-text)' }}>{file.name}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ide-text-muted)' }}>Uploaded Project Attachment</p>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
