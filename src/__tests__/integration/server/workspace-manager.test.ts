import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node-pty before importing the module.
// A `default` export is required because `server/workspace-manager.mjs` now uses a
// static ESM default import of this CommonJS module.
vi.mock('node-pty', () => {
  const api = {
    spawn: vi.fn(() => ({
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      pid: 12345,
    })),
  };
  return { ...api, default: api };
});

// Mock child_process
// A `default` export is required: the server modules use ESM default imports of the
// CommonJS 'child_process' module, so the mock must expose both shapes.
vi.mock('child_process', () => {
  const api = {
    spawn: vi.fn(() => ({ pid: 12345, kill: vi.fn() })),
    execSync: vi.fn(() => ''),
    exec: vi.fn((cmd: string, opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      cb(null, 'stdout output', 'stderr output');
    }),
  };
  return { ...api, default: api };
});

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => ''),
    rmSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ isFile: () => true, size: 100 })),
  },
}));

// Mock os
vi.mock('os', () => ({
  default: {
    platform: vi.fn(() => 'linux'),
    tmpdir: vi.fn(() => '/tmp'),
  },
}));

import { WorkspaceManager, getSanitizedEnv, detectProfiles } from '../../../../server/workspace-manager.mjs';

describe('WorkspaceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeProjectId()', () => {
    it('should strip non-alphanumeric characters except underscore and hyphen', () => {
      // Arrange
      const input = 'my-project_123!@#$%';

      // Act
      const result = WorkspaceManager.sanitizeProjectId(input);

      // Assert
      expect(result).toBe('my-project_123');
    });

    it('should return "default" for empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = WorkspaceManager.sanitizeProjectId(input);

      // Assert
      expect(result).toBe('default');
    });

    it('should return "default" for null/undefined', () => {
      // Act
      const result1 = WorkspaceManager.sanitizeProjectId(null as any);
      const result2 = WorkspaceManager.sanitizeProjectId(undefined as any);

      // Assert
      expect(result1).toBe('default');
      expect(result2).toBe('default');
    });

    it('should return "default" for string with only special characters', () => {
      // Arrange
      const input = '!@#$%^&*()';

      // Act
      const result = WorkspaceManager.sanitizeProjectId(input);

      // Assert
      expect(result).toBe('default');
    });

    it('should preserve alphanumeric characters', () => {
      // Arrange
      const input = 'Project123';

      // Act
      const result = WorkspaceManager.sanitizeProjectId(input);

      // Assert
      expect(result).toBe('Project123');
    });
  });

  describe('getWorkspaceDir()', () => {
    it('should create directory if missing', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValueOnce(false);

      // Act
      const result = WorkspaceManager.getWorkspaceDir('test-project');

      // Assert
      expect(fs.default.mkdirSync).toHaveBeenCalled();
      expect(result).toContain('test-project');
    });

    it('should return existing directory path', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValueOnce(true);

      // Act
      const result = WorkspaceManager.getWorkspaceDir('existing-project');

      // Assert
      expect(result).toContain('existing-project');
    });

    it('should sanitize the project ID before creating directory', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValueOnce(false);

      // Act
      const result = WorkspaceManager.getWorkspaceDir('test!@#project');

      // Assert
      expect(result).toContain('testproject');
      expect(result).not.toContain('!');
    });
  });

  describe('detectProfiles()', () => {
    it('should return bash profile on linux', async () => {
      // Arrange
      const os = await import('os');
      (os.default.platform as any).mockReturnValue('linux');
      const fs = await import('fs');
      (fs.default.existsSync as any).mockImplementation((p: string) => p === '/bin/bash');

      // Act
      const profiles = detectProfiles();

      // Assert
      expect(profiles.length).toBeGreaterThan(0);
      expect(profiles.some((p: any) => p.id === 'bash')).toBe(true);
    });

    it('should return powershell profile on windows', async () => {
      // Arrange
      const os = await import('os');
      (os.default.platform as any).mockReturnValue('win32');
      const fs = await import('fs');
      (fs.default.existsSync as any).mockImplementation((p: string) => p === 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');

      // Act
      const profiles = detectProfiles();

      // Assert
      expect(profiles.length).toBeGreaterThan(0);
      expect(profiles.some((p: any) => p.id === 'powershell')).toBe(true);
    });

    it('should mark at least one profile as default', async () => {
      // Arrange
      const os = await import('os');
      (os.default.platform as any).mockReturnValue('linux');
      const fs = await import('fs');
      (fs.default.existsSync as any).mockImplementation((p: string) => p === '/bin/bash');

      // Act
      const profiles = detectProfiles();

      // Assert
      expect(profiles.some((p: any) => p.isDefault)).toBe(true);
    });

    it('should return empty array when no shells found', async () => {
      // Arrange
      const os = await import('os');
      (os.default.platform as any).mockReturnValue('linux');
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValue(false);
      const cp = await import('child_process');
      (cp.execSync as any).mockImplementation(() => {
        throw new Error('not found');
      });

      // Act
      const profiles = detectProfiles();

      // Assert
      expect(profiles).toEqual([]);
    });
  });

  describe('getSanitizedEnv()', () => {
    it('should strip sensitive env vars (SUPABASE, GROQ, KEY, TOKEN)', () => {
      // Arrange
      const originalEnv = { ...process.env };
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-key';
      process.env.GROQ_API_KEY = 'gsk_test123';
      process.env.SOME_TOKEN = 'token123';
      process.env.MY_KEY = 'key123';
      process.env.PASSWORD = 'pass123';
      process.env.DATABASE_URL = 'postgres://...';
      process.env.SECRET = 'secret';
      process.env.CREDENTIAL = 'cred';
      process.env.AUTH_TOKEN = 'auth';
      process.env.PRIVATE_KEY = 'private';
      process.env.COOKIE = 'cookie';
      process.env.ALLOWED_ORIGIN = '*';

      // Act
      const env = getSanitizedEnv();

      // Assert
      expect(env.SUPABASE_URL).toBeUndefined();
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
      expect(env.GROQ_API_KEY).toBeUndefined();
      expect(env.SOME_TOKEN).toBeUndefined();
      expect(env.MY_KEY).toBeUndefined();
      expect(env.PASSWORD).toBeUndefined();
      expect(env.DATABASE_URL).toBeUndefined();
      expect(env.SECRET).toBeUndefined();
      expect(env.CREDENTIAL).toBeUndefined();
      expect(env.AUTH_TOKEN).toBeUndefined();
      expect(env.PRIVATE_KEY).toBeUndefined();
      expect(env.COOKIE).toBeUndefined();
      expect(env.ALLOWED_ORIGIN).toBeUndefined();

      // Cleanup
      process.env = originalEnv;
    });

    it('should preserve safe env vars', () => {
      // Arrange
      const originalEnv = { ...process.env };
      process.env.PATH = '/usr/bin';
      process.env.HOME = '/home/user';
      vi.stubEnv('NODE_ENV', 'test');

      // Act
      const env = getSanitizedEnv();

      // Assert
      expect(env.PATH).toBe('/usr/bin');
      expect(env.HOME).toBe('/home/user');
      expect(env.NODE_ENV).toBe('test');

      // Cleanup
      process.env = originalEnv;
    });

    it('should set TERM and COLORTERM', () => {
      // Act
      const env = getSanitizedEnv();

      // Assert
      expect(env.TERM).toBe('xterm-256color');
      expect(env.COLORTERM).toBe('truecolor');
    });

    it('should set LANG to en_US.UTF-8 by default', () => {
      // Arrange
      const originalEnv = { ...process.env };
      delete process.env.LANG;

      // Act
      const env = getSanitizedEnv();

      // Assert
      expect(env.LANG).toBe('en_US.UTF-8');

      // Cleanup
      process.env = originalEnv;
    });

    it('should set PSExecutionPolicyPreference on Windows', async () => {
      // Arrange
      const os = await import('os');
      (os.default.platform as any).mockReturnValue('win32');

      // Act
      const env = getSanitizedEnv();

      // Assert
      expect(env.PSExecutionPolicyPreference).toBe('Bypass');
    });

    it('should not set PSExecutionPolicyPreference on Linux', async () => {
      // Arrange
      const os = await import('os');
      (os.default.platform as any).mockReturnValue('linux');

      // Act
      const env = getSanitizedEnv();

      // Assert
      expect(env.PSExecutionPolicyPreference).toBeUndefined();
    });
  });

  describe('Session management', () => {
    it('should create a new session', () => {
      // Arrange
      const projectId = 'test-project';

      // Act
      const session = WorkspaceManager.getOrCreateSession(projectId, { title: 'Test Session' });

      // Assert
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.title).toBe('Test Session');
      expect(session.status).toBe('running');
      expect(session.projectId).toBe('test-project');
    });

    it('should retrieve existing session by ID', () => {
      // Arrange
      const projectId = 'test-project';
      const session1 = WorkspaceManager.getOrCreateSession(projectId, { title: 'Session 1' });

      // Act
      const session2 = WorkspaceManager.getOrCreateSession(projectId, { sessionId: session1.id });

      // Assert
      expect(session2.id).toBe(session1.id);
    });

    it('should list sessions for a project', () => {
      // Arrange
      const projectId = 'list-test';
      WorkspaceManager.getOrCreateSession(projectId, { title: 'S1' });
      WorkspaceManager.getOrCreateSession(projectId, { title: 'S2' });

      // Act
      const sessions = WorkspaceManager.listSessions(projectId);

      // Assert
      expect(sessions.length).toBe(2);
      expect(sessions[0].title).toBeDefined();
      expect(sessions[1].title).toBeDefined();
    });

    it('should kill a session', () => {
      // Arrange
      const projectId = 'kill-test';
      const session = WorkspaceManager.getOrCreateSession(projectId, { title: 'To Kill' });

      // Act
      WorkspaceManager.killSession(session.id);
      const sessions = WorkspaceManager.listSessions(projectId);

      // Assert
      expect(sessions.length).toBe(0);
    });

    it('should return empty array for non-existent project sessions', () => {
      // Act
      const sessions = WorkspaceManager.listSessions('non-existent-project-xyz');

      // Assert
      expect(sessions).toEqual([]);
    });
  });

  describe('Port detection regex', () => {
    it('should match "localhost:3000" pattern', () => {
      // Arrange
      const regex = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|listening on|listening at)[\s:=]+(\d{3,5})/i;
      const output = 'Server running on localhost:3000';

      // Act
      const match = output.match(regex);

      // Assert
      expect(match).not.toBeNull();
      expect(match![1]).toBe('3000');
    });

    it('should match "listening on port 5000" pattern', () => {
      // Arrange
      const regex = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|listening on|listening at)[\s:=]+(\d{3,5})/i;
      const output = 'Server listening on port 5000';

      // Act
      const match = output.match(regex);

      // Assert
      expect(match).not.toBeNull();
      expect(match![1]).toBe('5000');
    });

    it('should match "127.0.0.1:8080" pattern', () => {
      // Arrange
      const regex = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|listening on|listening at)[\s:=]+(\d{3,5})/i;
      const output = 'Running at 127.0.0.1:8080';

      // Act
      const match = output.match(regex);

      // Assert
      expect(match).not.toBeNull();
      expect(match![1]).toBe('8080');
    });

    it('should not match ports below 1000', () => {
      // Arrange
      const regex = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|port|listening on|listening at)[\s:=]+(\d{3,5})/i;
      const output = 'Server on port 80';

      // Act
      const match = output.match(regex);

      // Assert
      expect(match).toBeNull();
    });
  });
});
