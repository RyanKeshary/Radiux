'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '@/context/AuthContext';
import { getUserColor, PresenceUser, ProjectMember } from '@/lib/types';
import { Users, FileCode, ChevronDown } from 'lucide-react';

interface ExtendedPresenceUser extends PresenceUser {
  fileName?: string;
  email?: string;
}

interface ProjectPresenceProps {
  projectId: string;
  activeFileId: string | null;
  activeFileName: string | null;
  members: ProjectMember[];
}

export function ProjectPresence({
  projectId,
  activeFileId,
  activeFileName,
  members,
}: ProjectPresenceProps) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<ExtendedPresenceUser[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // 1. Maintain single persistent WebsocketProvider for workspace presence
  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
    const roomName = `project-${projectId}-workspace-presence`;

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    providerRef.current = provider;
    const awareness = provider.awareness;

    const userColor = getUserColor(user?.id || 'guest');
    const initialUser: ExtendedPresenceUser = {
      id: user?.id || 'guest',
      name: user?.full_name || 'Anonymous Peer',
      email: user?.email || '',
      color: userColor,
      currentFileId: activeFileId,
      fileName: activeFileName || undefined,
    };

    // Set local state immediately so user sees at least 1 online (themselves) right away
    awareness.setLocalStateField('user', initialUser);
    setOnlineUsers([initialUser]);

    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const users: ExtendedPresenceUser[] = [];
      states.forEach((state: any) => {
        if (state.user) {
          users.push({
            id: state.user.id,
            name: state.user.name,
            email: state.user.email,
            color: state.user.color,
            currentFileId: state.user.currentFileId,
            fileName: state.user.fileName,
          });
        }
      });
      // Always ensure at least the local user is present
      if (users.length === 0) {
        setOnlineUsers([initialUser]);
      } else {
        setOnlineUsers(users);
      }
    };

    awareness.on('change', handleAwarenessChange);

    // Immediate check if awareness already has peers
    handleAwarenessChange();

    return () => {
      awareness.off('change', handleAwarenessChange);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
    };
  }, [projectId, user?.id]);

  // 2. Update local presence state (active file, name) without tearing down websocket connection!
  useEffect(() => {
    if (!providerRef.current) return;
    const awareness = providerRef.current.awareness;
    const userColor = getUserColor(user?.id || 'guest');

    const currentUserState = {
      id: user?.id || 'guest',
      name: user?.full_name || 'Anonymous Peer',
      email: user?.email || '',
      color: userColor,
      currentFileId: activeFileId,
      fileName: activeFileName || undefined,
    };

    awareness.setLocalStateField('user', currentUserState);
  }, [activeFileId, activeFileName, user?.full_name, user?.email]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDrawer(!showDrawer)}
        className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2d2d2d] border border-[#383b3d] transition-colors shadow-sm"
        title="View active collaborators and their files"
      >
        <div className="flex items-center gap-1.5 text-xs text-neutral-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-white">{onlineUsers.length}</span>
          <span className="hidden sm:inline text-neutral-400">online</span>
        </div>

        {/* Avatars */}
        <div className="flex items-center -space-x-1 overflow-hidden">
          {onlineUsers.slice(0, 4).map((u, idx) => (
            <div
              key={u.id + idx}
              style={{ backgroundColor: u.color }}
              className="w-5 h-5 rounded-full border border-[#1e1e1e] flex items-center justify-center text-[9px] font-bold text-black shadow-sm"
              title={`${u.name}${u.fileName ? ` (Editing: ${u.fileName})` : ''}`}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>

      {/* Collaborator details popover */}
      {showDrawer && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#252526] border border-[#3c3c3c] shadow-2xl z-50 p-3 text-xs text-[#cccccc]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#3c3c3c]">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>Collaborator Presence</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
              {onlineUsers.length} Active
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {onlineUsers.map((u, idx) => {
              const isCurrentUser = u.id === user?.id;
              return (
                <div
                  key={u.id + idx}
                  className="p-2 rounded-lg bg-[#1e1e1e] border border-[#333333] flex items-start gap-2.5"
                >
                  <div
                    style={{ backgroundColor: u.color }}
                    className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-black flex-shrink-0 mt-0.5"
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white flex items-center gap-1.5 truncate">
                      <span>{u.name}</span>
                      {isCurrentUser && (
                        <span className="text-[9px] px-1 py-0.1 rounded bg-white/10 text-neutral-300">
                          You
                        </span>
                      )}
                    </div>
                    {u.fileName ? (
                      <div className="flex items-center gap-1 text-[11px] text-sky-400 mt-0.5 truncate">
                        <FileCode className="w-3 h-3 flex-shrink-0" />
                        <span>Editing: {u.fileName}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        Browsing files
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
