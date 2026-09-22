import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pty = require('node-pty');

const WORKSPACES_ROOT = path.resolve(process.cwd(), '.workspaces');

// Ensure workspaces folder exists
if (!fs.existsSync(WORKSPACES_ROOT)) {
  fs.mkdirSync(WORKSPACES_ROOT, { recursive: true });
}

// Multi-session Terminal Tracking
// Map: sessionId -> Session
const activeSessions = new Map();
// Map: projectId -> Set<sessionId>
const projectSessions = new Map();

// Helper to sanitize environment variables so user terminal cannot access DB credentials or app secrets
export function getSanitizedEnv() {
  const safeEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    const isSensitive = /SUPABASE|SECRET|KEY|TOKEN|PASSWORD|DATABASE|CREDENTIAL|AUTH|RENDER|ALLOWED_ORIGIN|COOKIE/i.test(k);
    if (!isSensitive) {
      safeEnv[k] = v;
    }
  }
  safeEnv.TERM = 'xterm-256color';
  safeEnv.COLORTERM = 'truecolor';
  safeEnv.LANG = process.env.LANG || 'en_US.UTF-8';

  // Critical fix for Windows PowerShell: Bypass execution policy for current process and child runners (npm.ps1, npx.ps1)
  if (os.platform() === 'win32') {
    safeEnv.PSExecutionPolicyPreference = 'Bypass';
    if (!safeEnv.PATHEXT) {
      safeEnv.PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC';
    } else if (!safeEnv.PATHEXT.includes('.CMD')) {
      safeEnv.PATHEXT = `${safeEnv.PATHEXT};.CMD;.BAT;.EXE`;
    }
  }

  return safeEnv;
}

// Port regex pattern detecting web servers starting on ports 1000 - 65535
const PORT_REGEX = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|listening on|listening at)[\s:=]+(\d{3,5})/i;

function commandExists(cmd) {
  try {
    const check = os.platform() === 'win32' ? `where "${cmd}"` : `which "${cmd}"`;
    execSync(check, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Detect available terminal profiles on host operating system dynamically.
 * Only returns shells that are genuinely available on the system.
 */
export function detectProfiles() {
  const isWindows = os.platform() === 'win32';
  const profiles = [];

  if (isWindows) {
    // 1. Modern PowerShell 7 (pwsh)
    const hasPwsh = commandExists('pwsh');
    if (hasPwsh) {
      profiles.push({
        id: 'pwsh',
        name: 'PowerShell 7',
        executable: 'pwsh.exe',
        args: ['-ExecutionPolicy', 'Bypass', '-NoLogo'],
        icon: 'terminal',
        platform: 'win32',
        available: true,
        isDefault: true,
      });
    }

    // 2. Windows PowerShell
    const hasPs = fs.existsSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe') || commandExists('powershell');
    if (hasPs) {
      profiles.push({
        id: 'powershell',
        name: 'PowerShell',
        executable: 'powershell.exe',
        args: ['-ExecutionPolicy', 'Bypass', '-NoLogo'],
        icon: 'terminal',
        platform: 'win32',
        available: true,
        isDefault: !hasPwsh,
      });
    }

    // 3. Command Prompt (cmd)
    const hasCmd = fs.existsSync('C:\\Windows\\System32\\cmd.exe') || commandExists('cmd');
    if (hasCmd) {
      profiles.push({
        id: 'cmd',
        name: 'Command Prompt',
        executable: 'cmd.exe',
        args: [],
        icon: 'cmd',
        platform: 'win32',
        available: true,
        isDefault: false,
      });
    }

    // 4. Git Bash
    let gitBashPath = null;
    const gitBashCandidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Git\\bin\\bash.exe'),
      path.join(process.env.ProgramW6432 || '', 'Git\\bin\\bash.exe'),
    ];
    for (const cand of gitBashCandidates) {
      if (cand && fs.existsSync(cand)) {
        gitBashPath = cand;
        break;
      }
    }
    if (gitBashPath) {
      profiles.push({
        id: 'gitbash',
        name: 'Git Bash',
        executable: gitBashPath,
        args: ['--login', '-i'],
        icon: 'git',
        platform: 'win32',
        available: true,
        isDefault: false,
      });
    }

    // 5. WSL (Verify WSL has an active distribution installed)
    const hasWslExe = fs.existsSync('C:\\Windows\\System32\\wsl.exe') || commandExists('wsl');
    if (hasWslExe) {
      let wslUsable = false;
      try {
        const out = execSync('wsl.exe -l -q', { encoding: 'utf16le', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
        if (out && out.trim().length > 0) {
          wslUsable = true;
        }
      } catch (e) {
        wslUsable = false;
      }
      if (wslUsable) {
        profiles.push({
          id: 'wsl',
          name: 'WSL',
          executable: 'wsl.exe',
          args: [],
          icon: 'linux',
          platform: 'win32',
          available: true,
          isDefault: false,
        });
      }
    }
  } else {
    // Linux / macOS / Render container environment
    const userShell = process.env.SHELL;
    const hasBash = fs.existsSync('/bin/bash') || commandExists('bash');
    const hasZsh = fs.existsSync('/bin/zsh') || fs.existsSync('/usr/bin/zsh') || commandExists('zsh');
    const hasSh = fs.existsSync('/bin/sh') || commandExists('sh');

    if (hasBash) {
      profiles.push({
        id: 'bash',
        name: 'Bash',
        executable: '/bin/bash',
        args: ['-l'],
        icon: 'terminal',
        platform: 'linux',
        available: true,
        isDefault: true,
      });
    }

    if (hasZsh) {
      profiles.push({
        id: 'zsh',
        name: 'Zsh',
        executable: fs.existsSync('/bin/zsh') ? '/bin/zsh' : '/usr/bin/zsh',
        args: ['-l'],
        icon: 'terminal',
        platform: 'linux',
        available: true,
        isDefault: !hasBash,
      });
    }

    if (hasSh) {
      profiles.push({
        id: 'sh',
        name: 'Sh',
        executable: '/bin/sh',
        args: ['-l'],
        icon: 'terminal',
        platform: 'linux',
        available: true,
        isDefault: !hasBash && !hasZsh,
      });
    }
  }

  // Fallback if no profile flagged as default
  if (profiles.length > 0 && !profiles.some(p => p.isDefault)) {
    profiles[0].isDefault = true;
  }

  return profiles;
}

export const WorkspaceManager = {
  sanitizeProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') return 'default';
    const clean = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || 'default';
  },

  getWorkspaceDir(projectId) {
    const cleanId = this.sanitizeProjectId(projectId);
    const dir = path.resolve(WORKSPACES_ROOT, cleanId);
    if (!dir.startsWith(WORKSPACES_ROOT)) {
      throw new Error(`Security violation: Invalid project directory traversal attempted for ${projectId}`);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  },

  syncFileToDisk(projectId, relativePath, content) {
    try {
      const wsDir = this.getWorkspaceDir(projectId);
      const safeRelative = (relativePath || '').replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.resolve(wsDir, safeRelative);

      if (!fullPath.startsWith(wsDir)) {
        console.warn(`[WorkspaceManager] Blocked directory traversal attempt: ${relativePath}`);
        return;
      }

      const dirName = path.dirname(fullPath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }

      if (typeof content === 'string' && content.startsWith('data:') && content.includes(';base64,')) {
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

  getAvailableProfiles() {
    return detectProfiles();
  },

  listSessions(projectId) {
    const cleanId = this.sanitizeProjectId(projectId);
    const sessionIds = projectSessions.get(cleanId);
    if (!sessionIds) return [];

    const list = [];
    for (const sid of sessionIds) {
      const session = activeSessions.get(sid);
      if (session) {
        list.push({
          id: session.id,
          title: session.title,
          profileId: session.profileId,
          status: session.status,
          pid: session.ptyProcess?.pid || null,
          createdAt: session.createdAt,
          detectedPorts: Array.from(session.detectedPorts),
        });
      }
    }
    return list;
  },

  /**
   * Create or locate an existing pseudo-terminal session
   */
  getOrCreateSession(projectId, options = {}) {
    const cleanId = this.sanitizeProjectId(projectId);
    const wsDir = this.getWorkspaceDir(cleanId);
    const requestedSessionId = options.sessionId;

    if (requestedSessionId && activeSessions.has(requestedSessionId)) {
      return activeSessions.get(requestedSessionId);
    }

    // Determine profile
    const profiles = detectProfiles();
    let profile = profiles.find(p => p.id === options.profileId);
    if (!profile) {
      profile = profiles.find(p => p.isDefault) || profiles[0] || {
        id: 'fallback',
        name: 'Shell',
        executable: os.platform() === 'win32' ? 'powershell.exe' : '/bin/sh',
        args: os.platform() === 'win32' ? ['-ExecutionPolicy', 'Bypass', '-NoLogo'] : [],
      };
    }

    const sessionId = requestedSessionId || `term_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const sessionIndex = (projectSessions.get(cleanId)?.size || 0) + 1;
    const title = options.title || `${profile.name} ${sessionIndex}`;

    // Spawn genuine PTY process
    const cols = Math.max(10, options.cols || 80);
    const rows = Math.max(5, options.rows || 24);

    let ptyProcess = null;
    try {
      ptyProcess = pty.spawn(profile.executable, profile.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: wsDir,
        env: getSanitizedEnv(),
      });
    } catch (spawnErr) {
      console.error(`[WorkspaceManager] Failed to spawn PTY with ${profile.executable}:`, spawnErr);
      // Fallback to basic shell
      const fallbackExe = os.platform() === 'win32' ? 'cmd.exe' : '/bin/sh';
      ptyProcess = pty.spawn(fallbackExe, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: wsDir,
        env: getSanitizedEnv(),
      });
    }

    const session = {
      id: sessionId,
      projectId: cleanId,
      title,
      profileId: profile.id,
      shell: profile.executable,
      shellArgs: profile.args,
      ptyProcess,
      cwd: wsDir,
      clients: new Set(),
      detectedPorts: new Set(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      status: 'running',
      historyBuffer: '',
    };

    activeSessions.set(sessionId, session);
    if (!projectSessions.has(cleanId)) {
      projectSessions.set(cleanId, new Set());
    }
    projectSessions.get(cleanId).add(sessionId);

    // Handle PTY output
    ptyProcess.onData((data) => {
      session.lastActivity = Date.now();

      // Maintain rolling history buffer (up to 40KB) for fast tab reconnection
      session.historyBuffer += data;
      if (session.historyBuffer.length > 40000) {
        session.historyBuffer = session.historyBuffer.slice(-30000);
      }

      // Detect server ports from terminal stream
      const portMatch = data.match(PORT_REGEX);
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        if (port >= 1000 && port <= 65535 && port !== 1234 && port !== 3000) {
          session.detectedPorts.add(port);
          const portMsg = JSON.stringify({ type: 'port_detected', port, sessionId });
          session.clients.forEach((client) => {
            if (client.readyState === 1) client.send(portMsg);
          });
        }
      }

      // Broadcast raw terminal stream to all connected collaborator clients on this session
      const msg = JSON.stringify({ type: 'output', data, sessionId });
      session.clients.forEach((client) => {
        if (client.readyState === 1) client.send(msg);
      });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      session.status = 'exited';
      const exitMsg = JSON.stringify({ type: 'exit', code: exitCode, signal, sessionId });
      session.clients.forEach((client) => {
        if (client.readyState === 1) client.send(exitMsg);
      });
    });

    return session;
  },

  /**
   * Connect WebSocket client to pseudo-terminal session
   */
  connectTerminal(projectId, ws, options = {}) {
    const cleanId = this.sanitizeProjectId(projectId);
    const session = this.getOrCreateSession(cleanId, options);

    session.clients.add(ws);
    session.lastActivity = Date.now();

    // Send full initial state and history buffer
    ws.send(JSON.stringify({
      type: 'init',
      sessionId: session.id,
      title: session.title,
      profileId: session.profileId,
      running: session.status === 'running',
      pid: session.ptyProcess?.pid,
      ports: Array.from(session.detectedPorts),
      history: session.historyBuffer || '',
      availableProfiles: detectProfiles(),
      sessions: this.listSessions(cleanId),
    }));

    // Handle incoming terminal messages from client
    ws.on('message', (message) => {
      session.lastActivity = Date.now();
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'input') {
          if (session.ptyProcess && session.status === 'running') {
            session.ptyProcess.write(payload.data);
          }
        } else if (payload.type === 'resize') {
          if (session.ptyProcess && payload.cols && payload.rows) {
            try {
              session.ptyProcess.resize(Math.max(10, payload.cols), Math.max(5, payload.rows));
            } catch (e) {}
          }
        } else if (payload.type === 'kill') {
          // Send Ctrl+C interrupt sequence first
          if (session.ptyProcess) {
            session.ptyProcess.write('\x03');
          }
        } else if (payload.type === 'restart') {
          this.restartSession(session.id, payload.profileId);
        } else if (payload.type === 'rename' && payload.title) {
          this.renameSession(session.id, payload.title);
        }
      } catch (err) {
        // Raw keystroke fallback
        if (session.ptyProcess && session.status === 'running') {
          session.ptyProcess.write(message.toString());
        } else if (session.status === 'exited' && (message.toString() === '\r' || message.toString() === '\n')) {
          // Auto-restart on Enter key when exited
          this.restartSession(session.id);
        }
      }
    });

    ws.on('close', () => {
      session.clients.delete(ws);
      // Clean up orphaned session if no clients for 15 minutes
      if (session.clients.size === 0) {
        setTimeout(() => {
          const current = activeSessions.get(session.id);
          if (current && current.clients.size === 0) {
            this.killSession(session.id);
          }
        }, 15 * 60 * 1000);
      }
    });
  },

  restartSession(sessionId, newProfileId = null) {
    const session = activeSessions.get(sessionId);
    if (!session) return null;

    if (session.ptyProcess) {
      this.killPtyProcess(session.ptyProcess);
    }

    if (newProfileId) {
      const profiles = detectProfiles();
      const profile = profiles.find(p => p.id === newProfileId);
      if (profile) {
        session.profileId = profile.id;
        session.shell = profile.executable;
        session.shellArgs = profile.args;
        session.title = profile.name;
      }
    }

    try {
      const ptyProcess = pty.spawn(session.shell, session.shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: session.cwd,
        env: getSanitizedEnv(),
      });

      session.ptyProcess = ptyProcess;
      session.status = 'running';
      session.historyBuffer = '';

      ptyProcess.onData((data) => {
        session.lastActivity = Date.now();
        session.historyBuffer += data;
        const msg = JSON.stringify({ type: 'output', data, sessionId: session.id });
        session.clients.forEach((c) => {
          if (c.readyState === 1) c.send(msg);
        });
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        session.status = 'exited';
        const exitMsg = JSON.stringify({ type: 'exit', code: exitCode, signal, sessionId: session.id });
        session.clients.forEach((c) => {
          if (c.readyState === 1) c.send(exitMsg);
        });
      });

      const restartMsg = JSON.stringify({
        type: 'session_updated',
        sessionId: session.id,
        profileId: session.profileId,
        title: session.title,
        running: true,
        pid: ptyProcess.pid,
        restarted: true,
      });
      session.clients.forEach((c) => {
        if (c.readyState === 1) {
          c.send(restartMsg);
          c.send(JSON.stringify({ type: 'status', sessionId: session.id, running: true, pid: ptyProcess.pid, restarted: true }));
        }
      });

      return session;
    } catch (err) {
      console.error(`[WorkspaceManager] Failed to restart session ${sessionId}:`, err);
      return null;
    }
  },

  renameSession(sessionId, newTitle) {
    const session = activeSessions.get(sessionId);
    if (!session) return;
    session.title = newTitle.trim().slice(0, 32);
    const msg = JSON.stringify({ type: 'session_renamed', sessionId, title: session.title });
    session.clients.forEach((c) => {
      if (c.readyState === 1) c.send(msg);
    });
  },

  killSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    if (session.ptyProcess) {
      this.killPtyProcess(session.ptyProcess);
    }

    const killMsg = JSON.stringify({ type: 'session_closed', sessionId });
    session.clients.forEach((c) => {
      if (c.readyState === 1) {
        c.send(killMsg);
      }
    });

    activeSessions.delete(sessionId);
    const pSet = projectSessions.get(session.projectId);
    if (pSet) {
      pSet.delete(sessionId);
      if (pSet.size === 0) projectSessions.delete(session.projectId);
    }
  },

  killPtyProcess(ptyProc) {
    if (!ptyProc) return;
    try {
      if (os.platform() === 'win32') {
        spawn('taskkill', ['/pid', ptyProc.pid, '/f', '/t']);
      } else {
        try {
          process.kill(-ptyProc.pid, 'SIGKILL');
        } catch (e) {
          ptyProc.kill('SIGKILL');
        }
      }
    } catch (e) {
      try { ptyProc.kill(); } catch (err) {}
    }
  },

  /**
   * Execute a one-off command inside the sandboxed project workspace
   */
  async runCommand(projectId, command, options = {}) {
    const cleanId = this.sanitizeProjectId(projectId);
    const wsDir = this.getWorkspaceDir(cleanId);
    const timeout = options.timeout || 30000;
    const safeEnv = getSanitizedEnv();

    const { exec } = await import('child_process');
    return new Promise((resolve) => {
      const startTime = Date.now();
      exec(command, {
        cwd: wsDir,
        timeout,
        env: { ...process.env, ...safeEnv },
        maxBuffer: 1024 * 1024 * 4,
      }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;
        resolve({
          exitCode: error ? (error.code ?? 1) : 0,
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim(),
          duration,
          timedOut: error?.killed && error?.signal === 'SIGTERM',
        });
      });
    });
  },

  cleanupAllWorkspaces() {
    console.log(`[WorkspaceManager] Cleaning up ${activeSessions.size} active terminal sessions...`);
    for (const [sessionId, session] of activeSessions.entries()) {
      try {
        this.killPtyProcess(session.ptyProcess);
        session.clients.forEach((c) => {
          try { c.close(1001, 'Server shutting down'); } catch (e) {}
        });
      } catch (e) {}
    }
    activeSessions.clear();
    projectSessions.clear();
  },
};

