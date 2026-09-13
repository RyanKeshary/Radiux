import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Resolve utils.cjs directly via filesystem path to avoid package export map restrictions
const utilsPath = path.resolve(process.cwd(), 'node_modules', 'y-websocket', 'bin', 'utils.cjs');
const { setupWSConnection } = require(utilsPath);

const host = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '1234', 10);

const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('CodeCollab Real-time Sync Server Active');
});

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', setupWSConnection);

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, host, () => {
  console.log(`[CodeCollab] Yjs WebSocket server running on ${host}:${port}`);
});
