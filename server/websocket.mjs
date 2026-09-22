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
    console.log('[Radiux] Supabase admin client ready for WS auth verification');
  } catch (e) {
    console.warn('[Radiux] Could not initialize Supabase admin client:', e.message);
  }
} else {
  console.warn('[Radiux] SUPABASE_SERVICE_ROLE_KEY not set — WS auth verification disabled (dev mode)');
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
 * In production, allows configured ALLOWED_ORIGIN env var, any official Radiux Vercel domain, or local dev.
 */
function isOriginAllowed(requestOrigin) {
  if (!ALLOWED_ORIGIN || ALLOWED_ORIGIN === '*') return true; // allow all
  if (!requestOrigin) return true; // direct non-browser tool / CLI connection

  // Built-in allowance for official Radiux Vercel deployments & localhost
  const cleanReq = requestOrigin.replace(/^https?:\/\//, '').toLowerCase();
  if (
    cleanReq.startsWith('localhost') ||
    cleanReq.startsWith('127.0.0.1') ||
    cleanReq.includes('radiux') && cleanReq.endsWith('.vercel.app') ||
    cleanReq.endsWith('code-collab-ide.vercel.app')
  ) {
    return true;
  }

  const origins = ALLOWED_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
  return origins.some(o => {
    if (o === '*' || requestOrigin === o) return true;
    const cleanO = o.replace(/^https?:\/\//, '').toLowerCase();
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

// ============================================================================
// Multi-User Persistent Storage Helpers (Messages, Notifications, Partners)
// ============================================================================
const DATA_ROOT = path.resolve(process.cwd(), '.workspaces', 'data');
if (!fs.existsSync(DATA_ROOT)) {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
}

function loadJsonFile(filePath, defaultVal) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {}
  return defaultVal;
}

function saveJsonFile(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[Server] Failed to save ${filePath}:`, e);
  }
}

// Global user WebSocket registry for instant real-time dispatch to recipients
const globalUserSockets = new Map(); // userId -> Set<ws>

function registerUserSocket(userId, ws) {
  if (!userId || userId === 'guest') return;
  if (!globalUserSockets.has(userId)) {
    globalUserSockets.set(userId, new Set());
  }
  globalUserSockets.get(userId).add(ws);
}

function unregisterUserSocket(userId, ws) {
  if (!userId) return;
  const set = globalUserSockets.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) globalUserSockets.delete(userId);
  }
}

function sendToUser(userId, payload) {
  const sockets = globalUserSockets.get(userId);
  if (sockets) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    sockets.forEach(ws => {
      if (ws.readyState === 1) ws.send(raw);
    });
  }
}

// Project Messages
function getProjectMessages(projectId) {
  const file = path.join(WorkspaceManager.getWorkspaceDir(projectId), 'messages.json');
  return loadJsonFile(file, []);
}

function saveProjectMessage(projectId, message) {
  if (!message || !message.id) return message;
  const file = path.join(WorkspaceManager.getWorkspaceDir(projectId), 'messages.json');
  const msgs = loadJsonFile(file, []);
  if (!msgs.some(m => m.id === message.id)) {
    msgs.push(message);
    if (msgs.length > 500) msgs.splice(0, msgs.length - 500);
    saveJsonFile(file, msgs);
  }
  return message;
}

// Project Inline Comments
function getProjectComments(projectId) {
  const file = path.join(WorkspaceManager.getWorkspaceDir(projectId), 'comments.json');
  return loadJsonFile(file, []);
}

// Coding Partners
function getCodingPartners(userId) {
  const file = path.join(DATA_ROOT, 'coding_partners.json');
  const all = loadJsonFile(file, []);
  if (!userId) return all;
  return all.filter(p => p.requester_id === userId || p.receiver_id === userId);
}

function saveCodingPartner(partner) {
  if (!partner || !partner.id) return partner;
  const file = path.join(DATA_ROOT, 'coding_partners.json');
  const all = loadJsonFile(file, []);
  const idx = all.findIndex(p => p.id === partner.id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...partner };
  } else {
    all.unshift(partner);
  }
  saveJsonFile(file, all);
  return partner;
}

function updateCodingPartnerStatus(requestId, status) {
  const file = path.join(DATA_ROOT, 'coding_partners.json');
  const all = loadJsonFile(file, []);
  const p = all.find(item => item.id === requestId);
  if (p) {
    p.status = status;
    p.updated_at = new Date().toISOString();
    saveJsonFile(file, all);

    // Synchronize notification status immediately
    markGlobalNotificationRead({ partnerRequestId: requestId, actionStatus: status });

    return p;
  }
  return null;
}

function removeCodingPartner(partnerRequestId) {
  const file = path.join(DATA_ROOT, 'coding_partners.json');
  const all = loadJsonFile(file, []);
  const match = all.find(p => p.id === partnerRequestId);
  const filtered = all.filter(p => p.id !== partnerRequestId);
  saveJsonFile(file, filtered);
  deleteGlobalNotification({ partnerRequestId });
  return match;
}

// Multi-User Persistent Developer Profiles
function getProfiles() {
  const file = path.join(DATA_ROOT, 'profiles.json');
  return loadJsonFile(file, []);
}

function getProfile(userIdOrUsername) {
  if (!userIdOrUsername) return null;
  const clean = userIdOrUsername.replace(/^@/, '').toLowerCase().trim();
  const all = getProfiles();
  return all.find(p => p.id === userIdOrUsername || (p.username && p.username.toLowerCase() === clean) || (p.email && p.email.toLowerCase() === clean)) || null;
}

function saveProfile(profile) {
  if (!profile || !profile.id) return profile;
  const file = path.join(DATA_ROOT, 'profiles.json');
  const all = loadJsonFile(file, []);
  const idx = all.findIndex(p => p.id === profile.id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...profile, updated_at: new Date().toISOString() };
  } else {
    all.push({ ...profile, updated_at: new Date().toISOString() });
  }
  saveJsonFile(file, all);
  return idx !== -1 ? all[idx] : profile;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
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
      product: 'radiux',
      service: 'radiux-backend',
    }));
    return;
  }

  // Terminal API: Detected Profiles & Dynamic Sessions
  if (parsedUrl.pathname === '/api/terminal/profiles') {
    const profiles = WorkspaceManager.getAvailableProfiles();
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ profiles }));
    return;
  }

  if (parsedUrl.pathname === '/api/terminal/sessions') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    if (request.method === 'GET') {
      const sessions = WorkspaceManager.listSessions(projectId);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ sessions }));
      return;
    }
    if (request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const session = WorkspaceManager.getOrCreateSession(projectId, body);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          session: {
            id: session.id,
            title: session.title,
            profileId: session.profileId,
            status: session.status,
            pid: session.ptyProcess?.pid || null,
            createdAt: session.createdAt,
            detectedPorts: Array.from(session.detectedPorts),
          }
        }));
        return;
      } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
    if (request.method === 'DELETE') {
      try {
        const sessionId = parsedUrl.searchParams.get('sessionId');
        if (sessionId) {
          WorkspaceManager.killSession(sessionId);
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true }));
        return;
      } catch (err) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: err.message }));
        return;
      }
    }
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

  // 7. Messages API (Persistent multi-user chat storage & broadcast)
  if (parsedUrl.pathname === '/api/messages') {
    if (request.method === 'GET') {
      const projectId = parsedUrl.searchParams.get('projectId') || 'default';
      const messages = getProjectMessages(projectId);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ messages }));
      return;
    }
    if (request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const { projectId, message } = body;
        if (!projectId || !message) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'Missing projectId or message' }));
          return;
        }
        const saved = saveProjectMessage(projectId, message);
        // Broadcast over /comm to active clients in the project room
        const room = commRooms.get(projectId);
        if (room) {
          const chatPayload = JSON.stringify({ type: 'chat_message', message: saved });
          room.forEach(c => {
            if (c.ws.readyState === 1) c.ws.send(chatPayload);
          });
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, message: saved }));
        return;
      } catch (e) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 8. Coding Partners API (Friend request persistence & sync)
  if (parsedUrl.pathname === '/api/partners') {
    if (request.method === 'GET') {
      const userId = parsedUrl.searchParams.get('userId');
      const partners = getCodingPartners(userId);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ partners }));
      return;
    }
    if (request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const { partner } = body;
        if (!partner || !partner.id) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'Invalid partner payload' }));
          return;
        }
        const saved = saveCodingPartner(partner);
        // Send live partner request event to receiver
        sendToUser(partner.receiver_id, {
          type: 'partner_request_received',
          partner: saved,
        });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, partner: saved }));
        return;
      } catch (e) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
    if (request.method === 'PATCH') {
      try {
        const body = await readJsonBody(request);
        const { requestId, status } = body;
        const updated = updateCodingPartnerStatus(requestId, status);
        if (updated) {
          sendToUser(updated.requester_id, {
            type: 'partner_request_updated',
            partner: updated,
          });
          sendToUser(updated.receiver_id, {
            type: 'partner_request_updated',
            partner: updated,
          });

          if (status === 'accepted') {
            const acceptNotif = {
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              user_id: updated.requester_id,
              type: 'partner_accepted',
              title: 'Partner Request Accepted!',
              message: `${updated.profile?.full_name || 'Your peer'} accepted your coding partner request.`,
              sender_id: updated.receiver_id,
              sender_name: updated.profile?.full_name || 'Developer',
              sender_avatar: updated.profile?.avatar_url || '',
              partner_request_id: requestId,
              action_status: 'completed',
              read: false,
              created_at: new Date().toISOString(),
            };
            saveGlobalNotification(acceptNotif);
            sendToUser(updated.requester_id, {
              type: 'notification',
              notification: acceptNotif,
            });
          }
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, partner: updated }));
        return;
      } catch (e) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
    if (request.method === 'DELETE') {
      try {
        const body = await readJsonBody(request);
        const { partnerRequestId } = body;
        const removed = removeCodingPartner(partnerRequestId);
        if (removed) {
          deleteGlobalNotification({ partnerRequestId });
          sendToUser(removed.receiver_id, {
            type: 'partner_request_cancelled',
            partnerRequestId,
          });
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true }));
        return;
      } catch (e) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 11. Developer Profiles API (Cross-browser / cross-account identity persistence)
  if (parsedUrl.pathname === '/api/profiles') {
    if (request.method === 'GET') {
      const userId = parsedUrl.searchParams.get('userId');
      const username = parsedUrl.searchParams.get('username');
      if (userId || username) {
        const prof = getProfile(userId || username);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ profile: prof }));
        return;
      }
      const profiles = getProfiles();
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ profiles }));
      return;
    }
    if (request.method === 'POST' || request.method === 'PATCH') {
      try {
        const body = await readJsonBody(request);
        const saved = saveProfile(body.profile || body);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, profile: saved }));
        return;
      } catch (e) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 12. Inline Code Comments API (Real-time multi-user synchronization)
  if (parsedUrl.pathname === '/api/comments') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    if (request.method === 'GET') {
      const threads = getProjectComments(projectId);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ threads }));
      return;
    }
    if (request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const pId = body.projectId || projectId;
        const threads = body.threads;
        if (Array.isArray(threads)) {
          saveProjectComments(pId, threads);
          // Broadcast over /comm to active clients in the project room
          const room = commRooms.get(pId);
          if (room) {
            const payload = JSON.stringify({ type: 'comments_update', projectId: pId, threads });
            room.forEach(c => {
              if (c.ws.readyState === 1) c.ws.send(payload);
            });
          }
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true, threads }));
          return;
        }
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Missing threads array' }));
        return;
      } catch (e) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  // 13. Code Review Requests (Pull Requests) API (Real-time multi-user synchronization)
  if (parsedUrl.pathname === '/api/reviews') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    if (request.method === 'GET') {
      const reviews = getProjectReviews(projectId);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ reviews }));
      return;
    }
    if (request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const pId = body.projectId || projectId;
        const reviews = body.reviews;
        if (Array.isArray(reviews)) {
          saveProjectReviews(pId, reviews);

          // If a new review or update notification was provided
          if (body.notification && body.notification.user_id) {
            saveGlobalNotification(body.notification);
            sendToUser(body.notification.user_id, {
              type: 'notification',
              notification: body.notification,
            });
          }

          // Broadcast over /comm to active clients in the project room
          const room = commRooms.get(pId);
          if (room) {
            const payload = JSON.stringify({ type: 'reviews_update', projectId: pId, reviews });
            room.forEach(c => {
              if (c.ws.readyState === 1) c.ws.send(payload);
            });
          }
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ success: true, reviews }));
          return;
        }
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'Missing reviews array' }));
        return;
      } catch (e) {
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: e.message }));
        return;
      }
    }
  }

  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Radiux Real-time Sync & Workspace Server Active');
});

// ============================================================================
// Level 4 + 6: Communication Room Manager (WebRTC Voice Signaling + Chat/Activity)
// ============================================================================
// Map: projectId -> Set<{ ws, userId, userName, userColor, isMuted }>
const commRooms = new Map();

function handleCommConnection(ws, projectId, verifiedUser, queryUserId) {
  if (!commRooms.has(projectId)) {
    commRooms.set(projectId, new Set());
  }
  const room = commRooms.get(projectId);
  const initialUserId = verifiedUser?.id || (queryUserId && queryUserId !== 'undefined' ? queryUserId : 'guest');
  let clientMeta = {
    ws,
    peerId: `peer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    // Level 6: Use verified user identity if available
    userId: initialUserId,
    userName: verifiedUser?.user_metadata?.full_name || verifiedUser?.email?.split('@')[0] || 'Anonymous',
    userColor: '#38bdf8',
    isMuted: false,
    inVoice: false,
  };
  room.add(clientMeta);
  if (clientMeta.userId && clientMeta.userId !== 'guest') {
    registerUserSocket(clientMeta.userId, ws);
  }

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
        if (!verifiedUser && msg.userId) {
          if (clientMeta.userId && clientMeta.userId !== msg.userId) {
            unregisterUserSocket(clientMeta.userId, ws);
          }
          clientMeta.userId = msg.userId;
          clientMeta.userName = msg.userName || clientMeta.userName;
          registerUserSocket(clientMeta.userId, ws);
        }
        // Always allow color override
        clientMeta.userColor = msg.userColor || clientMeta.userColor;
        return;
      }

      // 2. Chat message broadcast & automatic persistence
      if (msg.type === 'chat_message') {
        const savedMsg = saveProjectMessage(projectId, msg.message);
        const chatPayload = JSON.stringify({
          type: 'chat_message',
          message: savedMsg,
        });
        room.forEach((client) => {
          if (client.ws.readyState === 1) {
            client.ws.send(chatPayload);
          }
        });
        return;
      }

      // 3. Partner request live broadcast
      if (msg.type === 'partner_request') {
        if (msg.partner) saveCodingPartner(msg.partner);
        if (msg.partner?.receiver_id) {
          sendToUser(msg.partner.receiver_id, {
            type: 'partner_request_received',
            partner: msg.partner,
          });
        }
        return;
      }

      // 3c. Inline Comments live broadcast
      if (msg.type === 'comments_update') {
        if (msg.threads) saveProjectComments(projectId, msg.threads);
        const payload = JSON.stringify({
          type: 'comments_update',
          projectId,
          threads: msg.threads,
        });
        room.forEach((client) => {
          if (client.ws.readyState === 1 && client.ws !== ws) {
            client.ws.send(payload);
          }
        });
        return;
      }

      // 3d. Code Review Requests (Pull Requests) live broadcast
      if (msg.type === 'reviews_update') {
        if (msg.reviews) saveProjectReviews(projectId, msg.reviews);
        const payload = JSON.stringify({
          type: 'reviews_update',
          projectId,
          reviews: msg.reviews,
        });
        room.forEach((client) => {
          if (client.ws.readyState === 1 && client.ws !== ws) {
            client.ws.send(payload);
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
    if (clientMeta.userId) {
      unregisterUserSocket(clientMeta.userId, ws);
    }
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

  // Route 1: Terminal stream WebSocket (/terminal?projectId=...&sessionId=...&profileId=...)
  if (parsedUrl.pathname === '/terminal') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    const token = parsedUrl.searchParams.get('token') || '';
    const sessionId = parsedUrl.searchParams.get('sessionId') || '';
    const profileId = parsedUrl.searchParams.get('profileId') || '';
    const title = parsedUrl.searchParams.get('title') || '';
    const cols = parseInt(parsedUrl.searchParams.get('cols') || '80', 10);
    const rows = parseInt(parsedUrl.searchParams.get('rows') || '24', 10);

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
      WorkspaceManager.connectTerminal(projectId, ws, {
        sessionId,
        profileId,
        title,
        cols,
        rows,
      });
    });
    return;
  }

  // Route 2: Real-time Communication (/comm?projectId=...)
  if (parsedUrl.pathname === '/comm') {
    const projectId = parsedUrl.searchParams.get('projectId') || 'default';
    const token = parsedUrl.searchParams.get('token') || '';
    const queryUserId = parsedUrl.searchParams.get('userId') || '';

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
      handleCommConnection(ws, projectId, verifiedUser, queryUserId);
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
  console.log(`[Radiux] Server running on ${host}:${port}`);
  console.log(`[Radiux] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Radiux] CORS origin: ${ALLOWED_ORIGIN || 'all (dev mode)'}`);
  console.log(`[Radiux] WS auth: ${supabaseAdmin ? 'enabled' : 'disabled (dev mode)'}`);
});

function gracefulShutdown(signal) {
  console.log(`[Radiux] Received ${signal}, closing server gracefully...`);
  server.close(() => {
    console.log('[Radiux] HTTP & WebSocket server closed.');
    WorkspaceManager.cleanupAllWorkspaces();
    process.exit(0);
  });
  // Force exit after 8s if sockets take too long
  setTimeout(() => {
    console.error('[Radiux] Forcing shutdown after timeout.');
    WorkspaceManager.cleanupAllWorkspaces();
    process.exit(1);
  }, 8000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
