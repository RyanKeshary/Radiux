'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { VoicePeer } from '@/lib/types';
import { config } from '@/lib/config';

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
  const myPeerIdRef = useRef<string | null>(null);

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

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'voice_ice_candidate',
            targetPeerId: peerId,
            candidate: event.candidate,
          })
        );
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
        console.warn(`[WebRTC] ICE connection to peer ${peerId} failed. Direct P2P STUN traversal failed; TURN relay server required for restrictive NATs/firewalls.`);
        closePeer(peerId);
      }
    };

    // If initiator, create and dispatch offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN && pc.localDescription) {
            wsRef.current.send(
              JSON.stringify({
                type: 'voice_offer',
                targetPeerId: peerId,
                offer: pc.localDescription,
              })
            );
          }
        })
        .catch((err) => console.error('[WebRTC] Offer error:', err));
    }

    return pc;
  }, [closePeer]);

  // Connect to signaling WebSocket only when actively participating in voice
  useEffect(() => {
    if (!isInVoice || !projectId) return;

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

        // Assigned own peerId from server
        if (msg.type === 'assigned_peer_id') {
          myPeerIdRef.current = msg.peerId;
          return;
        }

        // Existing peers in voice call
        if (msg.type === 'voice_room_peers') {
          setVoicePeers(msg.peers || []);
          // Connect to each existing peer (we are the initiator)
          if (msg.peers) {
            for (const peer of msg.peers) {
              createPeerConnection(peer.peerId, true);
            }
          }
          setConnectionState('connected');
          return;
        }

        // A new peer joined the voice room
        if (msg.type === 'voice_peer_joined') {
          setVoicePeers((prev) => {
            if (prev.some((p) => p.peerId === msg.peerId)) return prev;
            return [...prev, {
              peerId: msg.peerId,
              userId: msg.userId,
              userName: msg.userName,
              userColor: msg.userColor,
              isMuted: msg.isMuted,
            }];
          });
          return;
        }

        // A peer left voice
        if (msg.type === 'voice_peer_left') {
          closePeer(msg.peerId);
          return;
        }

        // A peer toggled mute
        if (msg.type === 'voice_peer_muted') {
          setVoicePeers((prev) =>
            prev.map((p) => (p.peerId === msg.peerId ? { ...p, isMuted: msg.isMuted } : p))
          );
          return;
        }

        // Received WebRTC Offer
        if (msg.type === 'voice_offer') {
          const pc = createPeerConnection(msg.fromPeerId, false);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'voice_answer',
                targetPeerId: msg.fromPeerId,
                answer,
              })
            );
          }
          return;
        }

        // Received WebRTC Answer
        if (msg.type === 'voice_answer') {
          const pc = peerConnectionsRef.current.get(msg.fromPeerId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
          }
          return;
        }

        // Received ICE Candidate
        if (msg.type === 'voice_ice_candidate') {
          const pc = peerConnectionsRef.current.get(msg.fromPeerId);
          if (pc && msg.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              console.error('[WebRTC] ICE candidate error:', e);
            }
          }
          return;
        }
      } catch (err) {
        console.error('[WebRTC] Signaling message error:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'voice_leave' }));
        } catch (e) {}
      }
      ws.close();
      wsRef.current = null;
    };
  }, [isInVoice, projectId, userId, userName, userColor, closePeer, createPeerConnection]);

  // Join Voice Call
  const joinVoice = async () => {
    try {
      setConnectionState('connecting');
      // Request microphone access
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

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'voice_join',
            isMuted: false,
          })
        );
      }

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

    // Close all active peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Clean up audio elements
    remoteAudioElementsRef.current.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    remoteAudioElementsRef.current.clear();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'voice_leave' }));
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

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'voice_mute',
          isMuted: newMuted,
        })
      );
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
