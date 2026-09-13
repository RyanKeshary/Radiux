'use client';

import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from '@/context/AuthContext';
import { getUserColor, PresenceUser } from '@/lib/types';
import { Users, Wifi } from 'lucide-react';

interface ProjectPresenceProps {
  projectId: string;
}

export function ProjectPresence({ projectId }: ProjectPresenceProps) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';
    const roomName = `project-${projectId}-workspace-presence`;

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    const awareness = provider.awareness;

    const userColor = getUserColor(user?.id || 'guest');
    awareness.setLocalStateField('user', {
      id: user?.id || 'guest',
      name: user?.full_name || 'Anonymous Peer',
      color: userColor,
    });

    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const users: PresenceUser[] = [];
      states.forEach((state: any) => {
        if (state.user) {
          users.push({
            id: state.user.id,
            name: state.user.name,
            color: state.user.color,
          });
        }
      });
      setOnlineUsers(users);
    };

    awareness.on('change', handleAwarenessChange);

    return () => {
      awareness.off('change', handleAwarenessChange);
      provider.destroy();
      ydoc.destroy();
    };
  }, [projectId, user?.id, user?.full_name]);

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#252526] border border-[#383b3d]">
      <div className="flex items-center gap-1 text-xs text-neutral-400">
        <Users className="w-3.5 h-3.5 text-sky-400" />
        <span className="font-medium text-white">{onlineUsers.length}</span>
        <span className="hidden sm:inline">online</span>
      </div>

      <div className="flex items-center -space-x-1.5 overflow-hidden">
        {onlineUsers.map((u, idx) => (
          <div
            key={u.id + idx}
            style={{ backgroundColor: u.color }}
            className="w-6 h-6 rounded-full border-2 border-[#1e1e1e] flex items-center justify-center text-[10px] font-bold text-black shadow-sm"
            title={`${u.name} (Active in workspace)`}
          >
            {u.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
