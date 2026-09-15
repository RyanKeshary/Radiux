'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  RotateCw, 
  Download, 
  Maximize2, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music,
  ExternalLink,
  Layers
} from 'lucide-react';

export interface MediaPreviewItem {
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'file';
  senderName?: string;
  timestamp?: string;
}

interface MediaPreviewModalProps {
  media: MediaPreviewItem | null;
  onClose: () => void;
  onOpenInEditor?: (media: MediaPreviewItem) => void;
}

export function MediaPreviewModal({
  media,
  onClose,
  onOpenInEditor,
}: MediaPreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    // Reset zoom and rotation when media changes
    setZoom(1);
    setRotation(0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, onClose]);

  if (!media) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.25));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = media.url;
    a.download = media.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenEditor = () => {
    if (onOpenInEditor) {
      onOpenInEditor(media);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-4 sm:p-6">
      <div 
        className="relative flex flex-col w-full max-w-5xl h-[85vh] border rounded-2xl shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-5 py-3.5 border-b select-none"
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 text-white flex-shrink-0">
              {media.type === 'image' && <ImageIcon className="w-5 h-5 text-rose-400" />}
              {media.type === 'video' && <Film className="w-5 h-5 text-purple-400" />}
              {media.type === 'audio' && <Music className="w-5 h-5 text-amber-400" />}
              {media.type === 'file' && <FileText className="w-5 h-5 text-sky-400" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate max-w-md" style={{ color: 'var(--ide-text)' }}>
                {media.name}
              </h3>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
                <span className="uppercase font-mono px-1.5 py-0.2 rounded border" style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}>
                  {media.type}
                </span>
                {media.senderName && (
                  <span>Shared by <strong style={{ color: 'var(--ide-text)' }}>{media.senderName}</strong></span>
                )}
                {media.timestamp && <span>&bull; {media.timestamp}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {media.type === 'image' && (
              <div 
                className="hidden sm:flex items-center gap-1 rounded-lg px-2 py-1 border mr-2"
                style={{
                  backgroundColor: 'var(--ide-input-bg)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.25}
                  title="Zoom Out"
                  className="p-1 disabled:opacity-30 rounded transition-colors"
                  style={{ color: 'var(--ide-text)' }}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-2 min-w-[48px] text-center" style={{ color: 'var(--ide-text)' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  title="Zoom In"
                  className="p-1 disabled:opacity-30 rounded transition-colors"
                  style={{ color: 'var(--ide-text)' }}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  title="Rotate 90°"
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--ide-text)' }}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReset}
                  title="Reset"
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--ide-text)' }}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {onOpenInEditor && (
              <button
                onClick={handleOpenEditor}
                title="Open in workspace editor tab"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in Editor</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              title="Download file"
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 hover:opacity-80 rounded-lg transition-colors ml-1"
              style={{ color: 'var(--ide-text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 overflow-auto flex items-center justify-center p-6 relative"
          style={{ backgroundColor: 'var(--ide-dock)' }}
        >
          {media.type === 'image' && (
            <div 
              className="transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full"
              style={{ 
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.url}
                alt={media.name}
                className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-2xl border"
                style={{ borderColor: 'var(--ide-border)' }}
              />
            </div>
          )}

          {media.type === 'video' && (
            <div className="max-w-4xl w-full flex flex-col items-center justify-center">
              <video
                controls
                autoPlay
                playsInline
                src={media.url}
                className="max-h-[65vh] w-full rounded-xl shadow-2xl border bg-black"
                style={{ borderColor: 'var(--ide-border)' }}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {media.type === 'audio' && (
            <div 
              className="max-w-md w-full p-8 rounded-2xl border shadow-2xl flex flex-col items-center gap-5"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
              }}
            >
              <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Music className="w-12 h-12 animate-pulse" />
              </div>
              <div className="text-center w-full">
                <h3 className="font-semibold text-base truncate" style={{ color: 'var(--ide-text)' }}>{media.name}</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--ide-text-muted)' }}>Audio Recording / Track</p>
              </div>
              <audio
                controls
                autoPlay
                src={media.url}
                className="w-full mt-2"
              />
            </div>
          )}

          {media.type === 'file' && (
            <div 
              className="max-w-sm w-full p-8 rounded-2xl border shadow-2xl flex flex-col items-center text-center gap-4"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
              }}
            >
              <div className="w-20 h-20 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <FileText className="w-10 h-10" />
              </div>
              <div>
                <p className="font-semibold text-base break-all" style={{ color: 'var(--ide-text)' }}>{media.name}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--ide-text-muted)' }}>Project Document / File</p>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow transition-colors mt-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Attachment</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-5 py-2.5 border-t flex items-center justify-between text-xs"
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text-muted)',
          }}
        >
          <div className="flex items-center gap-4">
            <span>CodeCollab In-Project Media Viewer</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>Press <kbd className="px-1.5 py-0.5 rounded border font-mono" style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}>Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
