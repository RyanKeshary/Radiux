'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { VoicePeer } from '@/lib/types';
import { config } from '@/lib/config';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface UseVoiceChatOptions {
  projectId: string;
  userId: string;
  userName: string;
  userColor: string;
  onActivityEvent?: (details: string) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export function useVoiceChat({
  projectId,
  userId,
  userName,
  userColor,
  onActivityEvent,
}: UseVoiceChatOptions) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voicePeers, setVoicePeers] = useState<VoicePeer[]>([]);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const supabaseVoiceChRef = useRef<any>(null);
  const myPeerIdRef = useRef<string>(userId);

  // Clean up a specific peer connection
  const closePeer = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    const audioEl = remoteAudioElementsRef.current.get(peerId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      remoteAudioElementsRef.current.delete(peerId);
    }
    setVoicePeers((prev) => prev.filter((p) => p.peerId !== peerId));
  }, []);

  // Create an RTCPeerConnection for a given remote peer
  const createPeerConnection = useCallback((peerId: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(peerId)) {
      return peerConnectionsRef.current.get(peerId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(peerId, pc);

    // Add local tracks to outgoing connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Universal Signaling sender across WebSocket and Supabase Realtime
    const sendSignaling = (msg: any) => {
      // 1. WebSocket send
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(msg));
        } catch (e) {}
      }
      // 2. Supabase Realtime broadcast send
      if (supabaseVoiceChRef.current) {
        try {
          supabaseVoiceChRef.current.send({
            type: 'broadcast',
            event: 'voice_signal',
            payload: { ...msg, fromPeerId: myPeerIdRef.current },
          });
        } catch (e) {}
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling({
          type: 'voice_ice_candidate',
          targetPeerId: peerId,
          candidate: event.candidate,
        });
      }
    };

    // Handle remote audio stream arrival
    pc.ontrack = (event) => {
      let audioEl = remoteAudioElementsRef.current.get(peerId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        remoteAudioElementsRef.current.set(peerId, audioEl);
      }
      audioEl.srcObject = event.streams[0] || new MediaStream([event.track]);
      audioEl.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeer(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[WebRTC] ICE connection to peer ${peerId} failed.`);
        closePeer(peerId);
      }
    };

    // If initiator, create and dispatch offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            sendSignaling({
              type: 'voice_offer',
              targetPeerId: peerId,
              offer: pc.localDescription,
            });
          }
        })
        .catch((err) => console.error('[WebRTC] Offer error:', err));
    }

    return pc;
  }, [closePeer]);

  // Connect to signaling (WebSocket + Supabase Realtime) only when actively participating in voice
  useEffect(() => {
    if (!isInVoice || !projectId) return;

    const sendSignaling = (msg: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(msg));
        } catch (e) {}
      }
      if (supabaseVoiceChRef.current) {
        try {
          supabaseVoiceChRef.current.send({
            type: 'broadcast',
            event: 'voice_signal',
            payload: { ...msg, fromPeerId: myPeerIdRef.current },
          });
        } catch (e) {}
      }
    };

    const handleSignalingPayload = async (msg: any) => {
      if (!msg) return;

      // Ignore messages sent by ourselves
      if (msg.fromPeerId && msg.fromPeerId === myPeerIdRef.current) return;
      if (msg.userId && msg.userId === userId) return;

      // Filter targeted messages
      if (msg.targetPeerId && msg.targetPeerId !== myPeerIdRef.current && msg.targetPeerId !== userId) {
        return;
      }

      // Assigned own peerId from server
      if (msg.type === 'assigned_peer_id') {
        myPeerIdRef.current = msg.peerId;
        return;
      }

      // Peer joined or announced
      if (msg.type === 'voice_join') {
        const peerId = msg.peerId || msg.fromPeerId || msg.userId;
        if (peerId && peerId !== myPeerIdRef.current) {
          setVoicePeers((prev) => {
            if (prev.some((p) => p.peerId === peerId)) return prev;
            return [...prev, {
              peerId,
              userId: msg.userId || peerId,
              userName: msg.userName || 'Collaborator',
              userColor: msg.userColor || '#38bdf8',
              isMuted: Boolean(msg.isMuted),
            }];
          });
          // Initiate connection to the joined peer
          createPeerConnection(peerId, true);
        }
        return;
      }

      // Existing peers in voice call
      if (msg.type === 'voice_room_peers') {
        setVoicePeers(msg.peers || []);
        if (msg.peers) {
          for (const peer of msg.peers) {
            if (peer.peerId !== myPeerIdRef.current) {
              createPeerConnection(peer.peerId, true);
            }
          }
        }
        setConnectionState('connected');
        return;
      }

      // A new peer joined the voice room
      if (msg.type === 'voice_peer_joined') {
        const peerId = msg.peerId || msg.fromPeerId;
        if (peerId && peerId !== myPeerIdRef.current) {
          setVoicePeers((prev) => {
            if (prev.some((p) => p.peerId === peerId)) return prev;
            return [...prev, {
              peerId,
              userId: msg.userId || peerId,
              userName: msg.userName || 'Collaborator',
              userColor: msg.userColor || '#38bdf8',
              isMuted: Boolean(msg.isMuted),
            }];
          });
        }
        return;
      }

      // A peer left voice
      if (msg.type === 'voice_peer_left' || msg.type === 'voice_leave') {
        const peerId = msg.peerId || msg.fromPeerId;
        if (peerId) closePeer(peerId);
        return;
      }

      // A peer toggled mute
      if (msg.type === 'voice_peer_muted' || msg.type === 'voice_mute') {
        const peerId = msg.peerId || msg.fromPeerId;
        if (peerId) {
          setVoicePeers((prev) =>
            prev.map((p) => (p.peerId === peerId ? { ...p, isMuted: Boolean(msg.isMuted) } : p))
          );
        }
        return;
      }

      // Received WebRTC Offer
      if (msg.type === 'voice_offer') {
        const fromId = msg.fromPeerId || msg.senderId;
        if (!fromId) return;
        const pc = createPeerConnection(fromId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignaling({
          type: 'voice_answer',
          targetPeerId: fromId,
          answer,
        });
        return;
      }

      // Received WebRTC Answer
      if (msg.type === 'voice_answer') {
        const fromId = msg.fromPeerId || msg.senderId;
        const pc = fromId ? peerConnectionsRef.current.get(fromId) : null;
        if (pc && msg.answer) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
        }
        return;
      }

      // Received ICE Candidate
      if (msg.type === 'voice_ice_candidate') {
        const fromId = msg.fromPeerId || msg.senderId;
        const pc = fromId ? peerConnectionsRef.current.get(fromId) : null;
        if (pc && msg.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {
            console.error('[WebRTC] ICE candidate error:', e);
          }
        }
        return;
      }
    };

    // A. Connect local WebSocket signaling
    const wsUrl = config.buildWsUrl('/comm', { projectId });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'identify',
          userId,
          userName,
          userColor,
        })
      );
      ws.send(
        JSON.stringify({
          type: 'voice_join',
          isMuted: false,
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await handleSignalingPayload(msg);
      } catch (err) {
        console.error('[WebRTC] WS parse error:', err);
      }
    };

    // B. Connect Supabase Realtime broadcast channel for cross-device signaling
    if (isSupabaseConfigured && supabase) {
      try {
        const ch = supabase.channel(`radiux_voice_${projectId}`);
        supabaseVoiceChRef.current = ch;
        ch.on('broadcast', { event: 'voice_signal' }, async ({ payload }: any) => {
          await handleSignalingPayload(payload);
        });
        ch.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            ch.send({
              type: 'broadcast',
              event: 'voice_signal',
              payload: {
                type: 'voice_join',
                userId,
                peerId: myPeerIdRef.current,
                userName,
                userColor,
                isMuted: false,
              },
            });
          }
        });
      } catch (e) {
        console.warn('[WebRTC] Supabase channel error:', e);
      }
    }

    return () => {
      sendSignaling({ type: 'voice_leave', peerId: myPeerIdRef.current });
      ws.close();
      wsRef.current = null;
      if (supabaseVoiceChRef.current && supabase) {
        supabase.removeChannel(supabaseVoiceChRef.current);
        supabaseVoiceChRef.current = null;
      }
    };
  }, [isInVoice, projectId, userId, userName, userColor, closePeer, createPeerConnection]);

  // Join Voice Call
  const joinVoice = async () => {
    try {
      setConnectionState('connecting');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      setIsInVoice(true);
      setIsMuted(false);

      if (onActivityEvent) {
        onActivityEvent(`${userName} joined voice chat`);
      }
    } catch (err: any) {
      console.error('[WebRTC] Microphone access denied or error:', err);
      setConnectionState('disconnected');
      alert(`Could not access microphone: ${err.message || 'Permission denied'}`);
    }
  };

  // Leave Voice Call
  const leaveVoice = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    remoteAudioElementsRef.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    remoteAudioElementsRef.current.clear();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'voice_leave' }));
    }
    if (supabaseVoiceChRef.current) {
      try {
        supabaseVoiceChRef.current.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: { type: 'voice_leave', peerId: myPeerIdRef.current },
        });
      } catch (e) {}
    }

    setVoicePeers([]);
    setIsInVoice(false);
    setIsMuted(false);
    setConnectionState('disconnected');

    if (onActivityEvent) {
      onActivityEvent(`${userName} left voice chat`);
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });
    setIsMuted(newMuted);

    const mutePayload = {
      type: 'voice_mute',
      peerId: myPeerIdRef.current,
      isMuted: newMuted,
    };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(mutePayload));
    }
    if (supabaseVoiceChRef.current) {
      try {
        supabaseVoiceChRef.current.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: mutePayload,
        });
      } catch (e) {}
    }
  };

  return {
    isInVoice,
    isMuted,
    voicePeers,
    connectionState,
    myPeerId: myPeerIdRef.current,
    joinVoice,
    leaveVoice,
    toggleMute,
  };
}
