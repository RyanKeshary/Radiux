import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pty = require('node-pty');

const WORKSPACES_ROOT = path.resolve(process.cwd(), '.workspaces');

// Ensure workspaces folder exists
if (!fs.existsSync(WORKSPACES_ROOT)) {
  fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
}

// Map: projectId -> { ptyProcess, cwd, clients: Set<WebSocket>, detectedPorts: Set<number> }
const activeWorkspaces = new Map();

// Helper to sanitize environment variables so user terminal cannot access DB credentials or app secrets
export function getSanitizedEnv() {
  const safeEnv = {};
  // Retain only safe standard system environment variables
  const allowedPrefixes = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_', 'TERM', 'COLORTERM', 'TMP', 'TEMP'];
  for (const [k, v] of Object.entries(process.env)) {
    const isSensitive = /SUPABASE|SECRET|KEY|TOKEN|PASSWORD|DATABASE|CREDENTIAL|AUTH|RENDER|ALLOWED_ORIGIN|PORT|COOKIE/i.test(k);
    if (!isSensitive) {
      safeEnv[k] = v;
    }
  }
  // Ensure terminal variables are set properly
  safeEnv.TERM = 'xterm-256color';
  safeEnv.COLORTERM = 'truecolor';
  return safeEnv;
}

// Port regex pattern detecting web servers starting on ports 1000 - 65535
const PORT_REGEX = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|listening on|listening at)[\s:=]+(\d{3,5})/i;

export const WorkspaceManager = {
  sanitizeProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') return 'default';
    const clean = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || 'default';
  },

  getWorkspaceDir(projectId) {
    const cleanId = this.sanitizeProjectId(projectId);
    const dir = path.resolve(WORKSPACES_ROOT, cleanId);
    // Enforce isolation inside WORKSPACES_ROOT
    if (!dir.startsWith(WORKSPACES_ROOT)) {
      throw new Error(`Security violation: Invalid project directory traversal attempted for ${projectId}`);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  },

  // Sync initial files or specific file update into workspace disk
  syncFileToDisk(projectId, relativePath, content) {
    try {
      const wsDir = this.getWorkspaceDir(projectId);
      const safeRelative = (relativePath || '').replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.resolve(wsDir, safeRelative);

      // Prevent directory traversal out of workspace
      if (!fullPath.startsWith(wsDir)) {
        console.warn(`[WorkspaceManager] Blocked directory traversal attempt: ${relativePath}`);
        return;
      }

      const dirName = path.dirname(fullPath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }

      if (typeof content === 'string' && content.startsWith('data:') && content.includes(';base64,')) {
        // Decode base64 media data URL to binary buffer
        const base64Data = content.split(';base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(fullPath, buffer);
      } else {
        fs.writeFileSync(fullPath, content ?? '', 'utf8');
      }
    } catch (err) {
      console.error(`[WorkspaceManager] Failed to sync file ${relativePath}:`, err);
    }
  },

  deleteFileFromDisk(projectId, relativePath) {
    try {
      const wsDir = this.getWorkspaceDir(projectId);
      const safeRelative = (relativePath || '').replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.resolve(wsDir, safeRelative);

      // Prevent directory traversal out of workspace
      if (!fullPath.startsWith(wsDir)) {
        console.warn(`[WorkspaceManager] Blocked directory traversal attempt: ${relativePath}`);
        return;
      }

      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[WorkspaceManager] Failed to delete file ${relativePath}:`, err);
    }
  },

  // Start or get existing pseudo-terminal session
  connectTerminal(projectId, ws) {
    const wsDir = this.getWorkspaceDir(projectId);

    let workspace = activeWorkspaces.get(projectId);
    if (!workspace) {
      const isWindows = os.platform() === 'win32';
      const shell = isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash');
      const shellArgs = isWindows ? ['-NoLogo'] : [];

      // Spawn genuine pseudo-terminal using node-pty
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: wsDir,
        env: getSanitizedEnv(),
      });

      workspace = {
        ptyProcess,
        cwd: wsDir,
        clients: new Set(),
        detectedPorts: new Set(),
      };

      activeWorkspaces.set(projectId, workspace);

      // Handle PTY output
      ptyProcess.onData((data) => {
        // Detect server ports from terminal stream
        const portMatch = data.match(PORT_REGEX);
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          if (port >= 1000 && port <= 65535 && port !== 1234 && port !== 3000) {
            workspace.detectedPorts.add(port);
            const portMsg = JSON.stringify({ type: 'port_detected', port });
            workspace.clients.forEach((client) => {
              if (client.readyState === 1) client.send(portMsg);
            });
          }
        }

        // Broadcast raw terminal stream to all connected collaborator terminal panels
        const msg = JSON.stringify({ type: 'output', data });
        workspace.clients.forEach((client) => {
          if (client.readyState === 1) client.send(msg);
        });
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        const exitMsg = JSON.stringify({ type: 'exit', code: exitCode, signal });
        workspace.clients.forEach((client) => {
          if (client.readyState === 1) client.send(exitMsg);
        });
        activeWorkspaces.delete(projectId);
      });
    }

    workspace.clients.add(ws);

    // Send initial status and existing detected ports
    ws.send(JSON.stringify({
      type: 'status',
      running: Boolean(workspace.ptyProcess),
      pid: workspace.ptyProcess?.pid,
      ports: Array.from(workspace.detectedPorts)
    }));

    // Handle incoming terminal messages from client
    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'input') {
          if (workspace.ptyProcess) {
            workspace.ptyProcess.write(payload.data);
          }
        } else if (payload.type === 'resize') {
          if (workspace.ptyProcess && payload.cols && payload.rows) {
            try {
              workspace.ptyProcess.resize(Math.max(10, payload.cols), Math.max(5, payload.rows));
            } catch (e) {}
          }
        } else if (payload.type === 'kill') {
          // Send Ctrl+C sequence first, then kill if stubborn
          if (workspace.ptyProcess) {
            workspace.ptyProcess.write('\x03');
          }
        } else if (payload.type === 'restart') {
          if (workspace.ptyProcess) {
            this.killPtyProcess(workspace.ptyProcess);
          }
          activeWorkspaces.delete(projectId);
          this.connectTerminal(projectId, ws);
        }
      } catch (err) {
        // Fallback: raw keystroke data
        if (workspace.ptyProcess) {
          workspace.ptyProcess.write(message.toString());
        }
      }
    });

    ws.on('close', () => {
      workspace.clients.delete(ws);
      // Clean up orphaned shells after 10 minutes of inactivity
      if (workspace.clients.size === 0) {
        setTimeout(() => {
          const current = activeWorkspaces.get(projectId);
          if (current && current.clients.size === 0 && current.ptyProcess) {
            this.killPtyProcess(current.ptyProcess);
            activeWorkspaces.delete(projectId);
          }
        }, 10 * 60 * 1000);
      }
    });
  },

  // Helper to safely kill a PTY process on Windows or Linux
  killPtyProcess(ptyProc) {
    if (!ptyProc) return;
    try {
      if (os.platform() === 'win32') {
        spawn('taskkill', ['/pid', ptyProc.pid, '/f', '/t']);
      } else {
        try {
          // On Linux/macOS, kill process group if possible
          process.kill(-ptyProc.pid, 'SIGKILL');
        } catch (e) {
          ptyProc.kill('SIGKILL');
        }
      }
    } catch (e) {
      try { ptyProc.kill(); } catch (err) {}
    }
  },

  // Gracefully terminate all active PTY processes and sessions during server shutdown
  cleanupAllWorkspaces() {
    console.log(`[WorkspaceManager] Cleaning up ${activeWorkspaces.size} active workspace sessions...`);
    for (const [projectId, workspace] of activeWorkspaces.entries()) {
      try {
        this.killPtyProcess(workspace.ptyProcess);
        workspace.clients.forEach(c => {
          try { c.close(1001, 'Server shutting down'); } catch (e) {}
        });
      } catch (e) {}
    }
    activeWorkspaces.clear();
  }
};


