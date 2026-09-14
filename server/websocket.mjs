import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import url from 'url';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { WorkspaceManager } from './workspace-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Resolve utils.cjs directly via filesystem path to avoid package export map restrictions
const utilsPath = path.resolve(process.cwd(), 'node_modules', 'y-websocket', 'bin', 'utils.cjs');
const { setupWSConnection } = require(utilsPath);

const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '1234', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((request, response) => {
  // Global CORS & permissive embedding headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Allow iframe embedding from localhost:3000
  response.setHeader('X-Frame-Options', 'ALLOWALL');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  // 1. Static Project File Web Preview: /preview/:projectId/*
  if (parsedUrl.pathname.startsWith('/preview/')) {
    const parts = parsedUrl.pathname.replace(/^\/preview\//, '').split('/');
    const projectId = parts[0];
    let subPath = parts.slice(1).join('/');

    if (!projectId) {
      response.writeHead(400, { 'Content-Type': 'text/plain' });
      response.end('Missing projectId');
      return;
    }

    const wsDir = WorkspaceManager.getWorkspaceDir(projectId);

    if (!subPath || subPath === '') {
      subPath = 'index.html';
    }

    const targetFilePath = path.join(wsDir, subPath);

    // Prevent directory traversal attacks
    if (!targetFilePath.startsWith(wsDir)) {
      response.writeHead(403, { 'Content-Type': 'text/plain' });
      response.end('Forbidden');
      return;
    }

    if (fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).isFile()) {
      const ext = path.extname(targetFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
      const fileContent = fs.readFileSync(targetFilePath);
      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': fileContent.length,
      });
      response.end(fileContent);
      return;
    }

    // If file doesn't exist, provide a clean friendly HTML page inside preview
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #d4d4d4; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { background: #252526; border: 1px solid #3c3c3c; border-radius: 8px; padding: 24px 32px; max-width: 450px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
            h2 { color: #f87171; font-size: 16px; margin-top: 0; }
            p { font-size: 13px; line-height: 1.5; color: #a3a3a3; }
            code { background: #181818; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>File Not Found in Workspace</h2>
            <p>Could not locate <code>${subPath}</code> inside project files.</p>
            <p>Create an <code>index.html</code> in the file explorer to preview your web application instantly.</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  // 2. API endpoint to sync a file from browser to workspace disk
  if (parsedUrl.pathname === '/api/sync-file' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      try {
        const { projectId, path: filePath, content } = JSON.parse(body);
        if (projectId && filePath) {
          WorkspaceManager.syncFileToDisk(projectId, filePath, content);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true }));
          return;
        }
      } catch (e) {}
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Invalid payload' }));
    });
    return;
  }

  // 3. API endpoint to sync all project files initially
  if (parsedUrl.pathname === '/api/sync-project' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      try {
        const { projectId, files } = JSON.parse(body);
        if (projectId && Array.isArray(files)) {
          files.forEach(f => {
            if (!f.is_folder) {
              WorkspaceManager.syncFileToDisk(projectId, f.name, f.content || '');
            }
          });
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true }));
          return;
        }
      } catch (e) {}
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Invalid payload' }));
    });
    return;
  }

  // 4. Port connectivity probe endpoint (/api/check-port?port=5000)
  if (parsedUrl.pathname === '/api/check-port') {
    const probePort = parseInt(parsedUrl.searchParams.get('port') || '0', 10);
    if (!probePort) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ open: false, error: 'Invalid port' }));
      return;
    }

    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(400);

    socket.on('connect', () => {
      socket.destroy();
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ open: true, port: probePort }));
    });

    socket.on('timeout', () => {
      socket.destroy();
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ open: false, port: probePort }));
    });

    socket.on('error', () => {
      socket.destroy();
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ open: false, port: probePort }));
    });

    socket.connect(probePort, '127.0.0.1');
    return;
  }

  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('CodeCollab Real-time Sync & Workspace Server Active');
});

// ============================================================================
// Level 4: Communication Room Manager (WebRTC Voice Signaling + Chat/Activity)
// ============================================================================
// Map: projectId -> Set<{ ws, userId, userName, userColor, isMuted }>
const commRooms = new Map();

function handleCommConnection(ws, projectId) {
  if (!commRooms.has(projectId)) {
    commRooms.set(projectId, new Set());
  }
  const room = commRooms.get(projectId);
  let clientMeta = {
    ws,
    peerId: `peer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    userId: 'guest',
    userName: 'Anonymous',
    userColor: '#38bdf8',
    isMuted: false,
    inVoice: false,
  };
  room.add(clientMeta);

  // Send back own assigned peerId
  ws.send(JSON.stringify({
    type: 'assigned_peer_id',
    peerId: clientMeta.peerId,
  }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // 1. Client identifies itself
      if (msg.type === 'identify') {
        clientMeta.userId = msg.userId || clientMeta.userId;
        clientMeta.userName = msg.userName || clientMeta.userName;
        clientMeta.userColor = msg.userColor || clientMeta.userColor;
        return;
      }

      // 2. Chat message broadcast
      if (msg.type === 'chat_message') {
        // Broadcast to all clients in this project room (including sender if desired)
        const chatPayload = JSON.stringify({
          type: 'chat_message',
          message: msg.message,
        });
        room.forEach((client) => {
          if (client.ws.readyState === 1) {
            client.ws.send(chatPayload);
          }
        });
        return;
      }

      // 3. Activity event broadcast
      if (msg.type === 'activity_event') {
        const actPayload = JSON.stringify({
          type: 'activity_event',
          activity: msg.activity,
        });
        room.forEach((client) => {
          if (client.ws.readyState === 1) {
            client.ws.send(actPayload);
          }
        });
        return;
      }

      // 4. Voice: Join Room
      if (msg.type === 'voice_join') {
        clientMeta.inVoice = true;
        clientMeta.isMuted = Boolean(msg.isMuted);

        // Notify other voice members in room that a new peer joined
        const joinPayload = JSON.stringify({
          type: 'voice_peer_joined',
          peerId: clientMeta.peerId,
          userId: clientMeta.userId,
          userName: clientMeta.userName,
          userColor: clientMeta.userColor,
          isMuted: clientMeta.isMuted,
        });

        // Send existing voice peers back to the newly joined peer
        const existingPeers = [];
        room.forEach((c) => {
          if (c.peerId !== clientMeta.peerId && c.inVoice) {
            existingPeers.push({
              peerId: c.peerId,
              userId: c.userId,
              userName: c.userName,
              userColor: c.userColor,
              isMuted: c.isMuted,
            });
            if (c.ws.readyState === 1) {
              c.ws.send(joinPayload);
            }
          }
        });

        ws.send(JSON.stringify({
          type: 'voice_room_peers',
          peers: existingPeers,
        }));
        return;
      }

      // 5. Voice: WebRTC Signaling (Offer, Answer, ICE Candidate)
      if (
        msg.type === 'voice_offer' ||
        msg.type === 'voice_answer' ||
        msg.type === 'voice_ice_candidate'
      ) {
        const targetPeerId = msg.targetPeerId;
        const forwardPayload = JSON.stringify({
          ...msg,
          fromPeerId: clientMeta.peerId,
        });

        room.forEach((c) => {
          if (c.peerId === targetPeerId && c.ws.readyState === 1) {
            c.ws.send(forwardPayload);
          }
        });
        return;
      }

      // 6. Voice: Mute State update
      if (msg.type === 'voice_mute') {
        clientMeta.isMuted = Boolean(msg.isMuted);
        const mutePayload = JSON.stringify({
          type: 'voice_peer_muted',
          peerId: clientMeta.peerId,
          isMuted: clientMeta.isMuted,
        });
        room.forEach((c) => {
          if (c.peerId !== clientMeta.peerId && c.ws.readyState === 1) {
            c.ws.send(mutePayload);
          }
        });
        return;
      }

      // 7. Voice: Leave Room
      if (msg.type === 'voice_leave') {
        if (clientMeta.inVoice) {
          clientMeta.inVoice = false;
          const leavePayload = JSON.stringify({
            type: 'voice_peer_left',
            peerId: clientMeta.peerId,
          });
          room.forEach((c) => {
            if (c.peerId !== clientMeta.peerId && c.ws.readyState === 1) {
              c.ws.send(leavePayload);
            }
          });
        }
        return;
      }
    } catch (err) {
      console.error('[CommRoom] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    room.delete(clientMeta);
    if (clientMeta.inVoice) {
      const leavePayload = JSON.stringify({
        type: 'voice_peer_left',
        peerId: clientMeta.peerId,
      });
      room.forEach((c) => {
        if (c.ws.readyState === 1) {
          c.ws.send(leavePayload);
        }
      });
    }
    if (room.size === 0) {
      commRooms.delete(projectId);
    }
  });
}

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  // Route 1: Terminal stream WebSocket (/terminal?projectId=...)
  if (parsedUrl.pathname === '/terminal') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    wss.handleUpgrade(request, socket, head, (ws) => {
      WorkspaceManager.connectTerminal(projectId, ws);
    });
    return;
  }

  // Route 2: Real-time Communication (/comm?projectId=...)
  if (parsedUrl.pathname === '/comm') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleCommConnection(ws, projectId);
    });
    return;
  }

  // Route 3: Yjs document & presence sync rooms
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', setupWSConnection);

server.listen(port, host, () => {
  console.log(`[CodeCollab] Server running on ${host}:${port} (Yjs + Workspace Terminal + WebRTC Voice & Chat + Static Preview)`);
});

