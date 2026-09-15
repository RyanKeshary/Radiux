import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import url from 'url';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { WorkspaceManager } from './workspace-manager.mjs';
import { GitManager } from './git-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Resolve utils.cjs directly via filesystem path to avoid package export map restrictions
const utilsPath = path.resolve(process.cwd(), 'node_modules', 'y-websocket', 'bin', 'utils.cjs');
const { setupWSConnection } = require(utilsPath);

const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '1234', 10);

// Level 6: Production CORS — restrict WS origins in production
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || null; // null = allow all (dev mode)

// Level 6: Server-side Supabase client for WS auth verification
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabaseAdmin = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log('[CodeCollab] Supabase admin client ready for WS auth verification');
  } catch (e) {
    console.warn('[CodeCollab] Could not initialize Supabase admin client:', e.message);
  }
} else {
  console.warn('[CodeCollab] SUPABASE_SERVICE_ROLE_KEY not set — WS auth verification disabled (dev mode)');
}

/**
 * Verify a Supabase access token server-side.
 * Returns the user object or null if invalid.
 */
async function verifyToken(token) {
  if (!token || !supabaseAdmin) return null;
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (e) {
    return null;
  }
}

/**
 * Check if the request origin is allowed.
 * In production, restrict to ALLOWED_ORIGIN env var.
 */
function isOriginAllowed(requestOrigin) {
  if (!ALLOWED_ORIGIN || ALLOWED_ORIGIN === '*') return true; // dev mode — allow all
  if (!requestOrigin) return false;
  const origins = ALLOWED_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
  return origins.some(o => {
    if (o === '*' || requestOrigin === o) return true;
    const cleanO = o.replace(/^https?:\/\//, '');
    const cleanReq = requestOrigin.replace(/^https?:\/\//, '');
    return cleanReq === cleanO || cleanReq.endsWith('.' + cleanO);
  });
}

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
  // Level 6: Production CORS — only allow configured origin
  const origin = request.headers.origin || '';
  if (ALLOWED_ORIGIN) {
    if (isOriginAllowed(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    }
  } else {
    response.setHeader('Access-Control-Allow-Origin', '*');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Allow iframe embedding from frontend web app (localhost:3000, production domains)
  // Do NOT set X-Frame-Options: SAMEORIGIN because the frontend runs on port 3000 / custom domain
  response.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:* http://127.0.0.1:* https://* *;");

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  // Health check endpoint for Render service verification
  if (parsedUrl.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      status: 'ok',
      service: 'codecollab-backend',
    }));
    return;
  }

  // Dev Server Reverse Proxy for running dynamic ports on Render (e.g. /proxy/5000/*)
  if (parsedUrl.pathname.startsWith('/proxy/')) {
    const parts = parsedUrl.pathname.replace(/^\/proxy\//, '').split('/');
    const targetPort = parseInt(parts[0], 10);
    const targetPath = '/' + parts.slice(1).join('/') + (parsedUrl.search || '');

    if (!targetPort || isNaN(targetPort) || targetPort < 1000 || targetPort > 65535) {
      response.writeHead(400, { 'Content-Type': 'text/plain' });
      response.end('Invalid proxy port');
      return;
    }

    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: targetPort,
      path: targetPath,
      method: request.method,
      headers: {
        ...request.headers,
        host: `127.0.0.1:${targetPort}`,
      },
    }, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      delete headers['x-frame-options'];
      headers['content-security-policy'] = "frame-ancestors 'self' *;";
      const origin = request.headers.origin || '';
      if (ALLOWED_ORIGIN) {
        if (isOriginAllowed(origin)) {
          headers['access-control-allow-origin'] = origin;
        } else {
          headers['access-control-allow-origin'] = ALLOWED_ORIGIN;
        }
      } else {
        headers['access-control-allow-origin'] = '*';
      }
      response.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(response);
    });

    proxyReq.on('error', () => {
      response.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1e1e1e; color: #d4d4d4; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .box { background: #252526; border: 1px solid #3c3c3c; border-radius: 8px; padding: 24px 32px; max-width: 450px; text-align: center; }
              h2 { color: #f59e0b; font-size: 16px; margin-top: 0; }
              p { font-size: 13px; color: #a3a3a3; }
              code { background: #181818; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2>Server Not Responding on Port ${targetPort}</h2>
              <p>Could not connect to service on port <code>${targetPort}</code>.</p>
              <p>Ensure your application is started and listening in the terminal.</p>
            </div>
          </body>
        </html>
      `);
    });

    request.pipe(proxyReq);
    return;
  }

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

  // 5. Level 5: Git Endpoints
  if (parsedUrl.pathname.startsWith('/api/git/')) {
    const action = parsedUrl.pathname.replace(/^\/api\/git\//, '');
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', async () => {
      try {
        let payload = {};
        if (body) {
          try { payload = JSON.parse(body); } catch (e) {}
        }
        const projectId = payload.projectId || parsedUrl.searchParams.get('projectId');

        if (!projectId) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'Missing projectId' }));
          return;
        }

        if (action === 'status') {
          const status = await GitManager.getStatus(projectId);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(status));
          return;
        }

        if (action === 'init') {
          const res = await GitManager.init(projectId, payload.userName, payload.userEmail);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'stage') {
          const res = await GitManager.stage(projectId, payload.files);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'unstage') {
          const res = await GitManager.unstage(projectId, payload.files);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'discard') {
          const res = await GitManager.discard(projectId, payload.files);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'commit') {
          const res = await GitManager.commit(projectId, payload.message, payload.userName, payload.userEmail);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'log') {
          const limit = parseInt(parsedUrl.searchParams.get('limit') || '40', 10);
          const commits = await GitManager.getLog(projectId, limit);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ commits }));
          return;
        }

        if (action === 'diff') {
          const file = parsedUrl.searchParams.get('file') || payload.file;
          const staged = parsedUrl.searchParams.get('staged') === 'true' || payload.staged === true;
          const commit = parsedUrl.searchParams.get('commit') || payload.commit;
          const diffRes = await GitManager.getDiff(projectId, file, staged, commit);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(diffRes));
          return;
        }

        if (action === 'branches') {
          const data = await GitManager.getBranches(projectId);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(data));
          return;
        }

        if (action === 'branch/create') {
          const res = await GitManager.createBranch(projectId, payload.branchName);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'branch/switch') {
          const res = await GitManager.switchBranch(projectId, payload.branchName);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'branch/delete') {
          const res = await GitManager.deleteBranch(projectId, payload.branchName);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'merge') {
          const res = await GitManager.mergeBranch(projectId, payload.branchName);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'remotes') {
          const remotes = await GitManager.getRemotes(projectId);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ remotes }));
          return;
        }

        if (action === 'remote/set') {
          const res = await GitManager.setRemote(projectId, payload.name || 'origin', payload.url);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'remote/remove') {
          const res = await GitManager.removeRemote(projectId, payload.name || 'origin');
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'push') {
          const res = await GitManager.push(projectId, payload.remote || 'origin', payload.branch, payload.token);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'pull') {
          const res = await GitManager.pull(projectId, payload.remote || 'origin', payload.branch, payload.token);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        if (action === 'clone') {
          const res = await GitManager.clone(projectId, payload.repoUrl, payload.token);
          response.writeHead(res.success ? 200 : 500, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(res));
          return;
        }

        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: `Unknown Git action: ${action}` }));
      } catch (err) {
        console.error('[Git API Error]', err);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 6. Read workspace files from disk for synchronization or import
  if (parsedUrl.pathname === '/api/workspace/files') {
    const projectId = parsedUrl.searchParams.get('projectId');
    if (!projectId) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Missing projectId' }));
      return;
    }
    const wsDir = WorkspaceManager.getWorkspaceDir(projectId);
    
    // Recursive scanner returning array of relative files
    function scanDir(currentDir, relBase = '') {
      let results = [];
      if (!fs.existsSync(currentDir)) return results;
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const item of items) {
        if (item.name === '.git' || item.name === 'node_modules') continue;
        const relPath = relBase ? `${relBase}/${item.name}` : item.name;
        const fullItemPath = path.join(currentDir, item.name);
        if (item.isDirectory()) {
          results.push({ name: item.name, path: relPath, is_folder: true });
          results = results.concat(scanDir(fullItemPath, relPath));
        } else {
          try {
            const stat = fs.statSync(fullItemPath);
            // Skip massive files >5MB for json transfer
            if (stat.size < 5 * 1024 * 1024) {
              const content = fs.readFileSync(fullItemPath, 'utf8');
              results.push({ name: item.name, path: relPath, is_folder: false, content });
            }
          } catch (e) {}
        }
      }
      return results;
    }

    const files = scanDir(wsDir);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ files }));
    return;
  }

  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('CodeCollab Real-time Sync & Workspace Server Active');
});

// ============================================================================
// Level 4 + 6: Communication Room Manager (WebRTC Voice Signaling + Chat/Activity)
// ============================================================================
// Map: projectId -> Set<{ ws, userId, userName, userColor, isMuted }>
const commRooms = new Map();

function handleCommConnection(ws, projectId, verifiedUser) {
  if (!commRooms.has(projectId)) {
    commRooms.set(projectId, new Set());
  }
  const room = commRooms.get(projectId);
  let clientMeta = {
    ws,
    peerId: `peer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    // Level 6: Use verified user identity if available
    userId: verifiedUser?.id || 'guest',
    userName: verifiedUser?.user_metadata?.full_name || verifiedUser?.email?.split('@')[0] || 'Anonymous',
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

      // 1. Client identifies itself (only allows overriding color, not userId/userName in production)
      if (msg.type === 'identify') {
        // If no verified user, allow identity from message (dev/mock mode)
        if (!verifiedUser) {
          clientMeta.userId = msg.userId || clientMeta.userId;
          clientMeta.userName = msg.userName || clientMeta.userName;
        }
        // Always allow color override
        clientMeta.userColor = msg.userColor || clientMeta.userColor;
        return;
      }

      // 2. Chat message broadcast
      if (msg.type === 'chat_message') {
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

        const joinPayload = JSON.stringify({
          type: 'voice_peer_joined',
          peerId: clientMeta.peerId,
          userId: clientMeta.userId,
          userName: clientMeta.userName,
          userColor: clientMeta.userColor,
          isMuted: clientMeta.isMuted,
        });

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

server.on('upgrade', async (request, socket, head) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  // Level 6: Origin check for WS connections
  const origin = request.headers.origin || '';
  if (ALLOWED_ORIGIN && !isOriginAllowed(origin)) {
    console.warn(`[WS] Rejected connection from unauthorized origin: ${origin}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  // Route 1: Terminal stream WebSocket (/terminal?projectId=...)
  if (parsedUrl.pathname === '/terminal') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    const token = parsedUrl.searchParams.get('token') || '';

    // Level 6: Verify token for terminal access
    let verifiedUser = null;
    if (token) {
      verifiedUser = await verifyToken(token);
    }

    // In dev mode (no service role key), allow without verification
    if (SUPABASE_SERVICE_ROLE_KEY && !verifiedUser) {
      console.warn(`[WS/terminal] Rejected unauthenticated terminal connection for project: ${projectId}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      WorkspaceManager.connectTerminal(projectId, ws);
    });
    return;
  }

  // Route 2: Real-time Communication (/comm?projectId=...)
  if (parsedUrl.pathname === '/comm') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    const token = parsedUrl.searchParams.get('token') || '';

    // Level 6: Verify token
    let verifiedUser = null;
    if (token) {
      verifiedUser = await verifyToken(token);
    }

    // In dev mode (no service role key), allow without verification
    if (SUPABASE_SERVICE_ROLE_KEY && !verifiedUser) {
      console.warn(`[WS/comm] Rejected unauthenticated comm connection for project: ${projectId}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      handleCommConnection(ws, projectId, verifiedUser);
    });
    return;
  }

  // Route 3: Yjs document & presence sync rooms
  // Yjs handles its own document-level access — authorization enforced by Supabase RLS at DB level
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', setupWSConnection);

server.listen(port, host, () => {
  console.log(`[CodeCollab] Server running on ${host}:${port}`);
  console.log(`[CodeCollab] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[CodeCollab] CORS origin: ${ALLOWED_ORIGIN || 'all (dev mode)'}`);
  console.log(`[CodeCollab] WS auth: ${supabaseAdmin ? 'enabled' : 'disabled (dev mode)'}`);
});

function gracefulShutdown(signal) {
  console.log(`[CodeCollab] Received ${signal}, closing server gracefully...`);
  server.close(() => {
    console.log('[CodeCollab] HTTP & WebSocket server closed.');
    WorkspaceManager.cleanupAllWorkspaces();
    process.exit(0);
  });
  // Force exit after 8s if sockets take too long
  setTimeout(() => {
    console.error('[CodeCollab] Forcing shutdown after timeout.');
    WorkspaceManager.cleanupAllWorkspaces();
    process.exit(1);
  }, 8000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
