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
  '.ico': 'image/x-icon',
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

  // Route 2: Yjs document & presence sync rooms
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', setupWSConnection);

server.listen(port, host, () => {
  console.log(`[CodeCollab] Server running on ${host}:${port} (Yjs + Workspace Terminal + Static Preview)`);
});
