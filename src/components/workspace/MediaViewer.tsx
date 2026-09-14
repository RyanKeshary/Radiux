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
    <div className="flex flex-col h-full w-full bg-[#181818] overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#333333] text-xs text-neutral-300">
        <div className="flex items-center gap-2">
          {isImage && <ImageIcon className="w-4 h-4 text-rose-400" />}
          {isVideo && <Film className="w-4 h-4 text-purple-400" />}
          {isAudio && <Music className="w-4 h-4 text-amber-400" />}
          {isOther && <FileText className="w-4 h-4 text-sky-400" />}
          <span className="font-semibold text-white truncate max-w-xs">{file.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#333333] text-neutral-400 uppercase font-mono">
            {file.name.split('.').pop() || 'FILE'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isImage && (
            <div className="flex items-center gap-1 bg-[#1e1e1e] rounded-md px-1.5 py-0.5 border border-[#3c3c3c]">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                title="Zoom Out"
                className="p-1 hover:text-white disabled:opacity-30 rounded hover:bg-[#333333]"
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
                className="p-1 hover:text-white disabled:opacity-30 rounded hover:bg-[#333333]"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRotate}
                title="Rotate 90°"
                className="p-1 hover:text-white rounded hover:bg-[#333333]"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                title="Reset View"
                className="p-1 hover:text-white rounded hover:bg-[#333333] ml-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleDownload}
            title="Download Media File"
            className="flex items-center gap-1 px-2.5 py-1 bg-[#333333] hover:bg-[#3c3c3c] text-white rounded font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Media Canvas / Preview Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px]">
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
              className="max-h-[75vh] max-w-[85vw] object-contain rounded shadow-2xl border border-[#333333] bg-[#0c0c0d]"
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
              className="max-h-[75vh] w-full rounded-lg shadow-2xl border border-[#333333] bg-black"
            >
              Your browser does not support the video tag.
            </video>
            <div className="mt-3 text-xs text-neutral-500 font-mono">
              Video Player &bull; HTML5 Compatible
            </div>
          </div>
        )}

        {isAudio && (
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#1e1e1e] border border-[#333333] shadow-2xl flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Music className="w-10 h-10 animate-pulse" />
            </div>
            <div className="text-center w-full">
              <h3 className="font-semibold text-white text-base truncate">{file.name}</h3>
              <p className="text-xs text-neutral-400 mt-1 font-mono uppercase">Audio Playback</p>
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
          <div className="max-w-sm w-full p-6 rounded-xl bg-[#1e1e1e] border border-[#333333] shadow-xl flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <p className="font-medium text-white text-sm break-all">{file.name}</p>
              <p className="text-xs text-neutral-400 mt-1">Uploaded Project Attachment</p>
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
