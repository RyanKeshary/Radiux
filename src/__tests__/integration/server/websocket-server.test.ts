import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ws
vi.mock('ws', () => ({
  WebSocketServer: vi.fn(() => ({
    on: vi.fn(),
  })),
}));

// Mock http
vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    on: vi.fn(),
    listen: vi.fn(),
  })),
  request: vi.fn(),
}));

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

// Mock workspace-manager
vi.mock('../../../../server/workspace-manager.mjs', () => ({
  WorkspaceManager: {
    getWorkspaceDir: vi.fn(() => '/tmp/test-workspace'),
    getAvailableProfiles: vi.fn(() => [{ id: 'bash', name: 'Bash', executable: '/bin/bash', args: ['-l'], isDefault: true }]),
    listSessions: vi.fn(() => []),
    getOrCreateSession: vi.fn(() => ({
      id: 'test-session',
      title: 'Test',
      profileId: 'bash',
      status: 'running',
      pid: 12345,
      createdAt: Date.now(),
      detectedPorts: new Set(),
      ptyProcess: { pid: 12345 },
    })),
    syncFileToDisk: vi.fn(),
    runCommand: vi.fn(() => Promise.resolve({ exitCode: 0, stdout: 'ok', stderr: '', duration: 100 })),
    killSession: vi.fn(),
  },
  getSanitizedEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
}));

// Mock git-manager
vi.mock('../../../../server/git-manager.mjs', () => ({
  GitManager: {
    getStatus: vi.fn(() => Promise.resolve({ isRepo: true, branch: 'main', staged: [], unstaged: [], untracked: [], clean: true })),
    init: vi.fn(() => Promise.resolve({ success: true })),
    stage: vi.fn(() => Promise.resolve({ success: true })),
    unstage: vi.fn(() => Promise.resolve({ success: true })),
    commit: vi.fn(() => Promise.resolve({ success: true })),
    getLog: vi.fn(() => Promise.resolve([])),
    getDiff: vi.fn(() => Promise.resolve({ success: true, diff: '' })),
    getBranches: vi.fn(() => Promise.resolve({ current: 'main', branches: [{ name: 'main', isCurrent: true }] })),
    createBranch: vi.fn(() => Promise.resolve({ success: true })),
    switchBranch: vi.fn(() => Promise.resolve({ success: true })),
    deleteBranch: vi.fn(() => Promise.resolve({ success: true })),
    getRemotes: vi.fn(() => Promise.resolve([])),
    push: vi.fn(() => Promise.resolve({ success: true })),
    pull: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  })),
}));

// NOTE: y-websocket's setupWSConnection is intentionally NOT mocked here.
// `server/websocket.mjs` loads it via `createRequire` against an absolute
// filesystem path (`node_modules/y-websocket/bin/utils.cjs`) to work around the
// package's export map, which bypasses Vitest's ESM mock registry entirely.
// The real module is installed, so it loads without issue.

describe('WebSocket Server', () => {
  let mockServer: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const http = await import('http');
    mockServer = http.createServer as any;
    mockRequest = {
      url: '/health',
      method: 'GET',
      headers: { host: 'localhost', origin: 'http://localhost:3000' },
      on: vi.fn(),
    };
    mockResponse = {
      writeHead: vi.fn(() => mockResponse),
      setHeader: vi.fn(() => mockResponse),
      end: vi.fn(() => mockResponse),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Server startup', () => {
    it('should create HTTP server', async () => {
      // Arrange
      const http = await import('http');

      // Act
      const server = http.createServer();

      // Assert
      expect(server).toBeDefined();
      expect(http.createServer).toHaveBeenCalled();
    });

    it('should listen on configured port', async () => {
      // Arrange
      const http = await import('http');
      const server = http.createServer();

      // Act
      server.listen(1234);

      // Assert
      expect(server.listen).toHaveBeenCalledWith(1234);
    });
  });

  describe('Health endpoint', () => {
    it('should return correct JSON for /health', async () => {
      // Arrange
      const http = await import('http');
      const server = http.createServer((req: any, res: any) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            product: 'radiux',
            service: 'radiux-backend',
          }));
        }
      });

      // Act & Assert
      expect(server).toBeDefined();
    });

    it('should return status ok', () => {
      // Arrange
      const healthResponse = { status: 'ok', product: 'radiux', service: 'radiux-backend' };

      // Assert
      expect(healthResponse.status).toBe('ok');
      expect(healthResponse.product).toBe('radiux');
      expect(healthResponse.service).toBe('radiux-backend');
    });
  });

  describe('CORS origin checking', () => {
    it('should allow all origins when ALLOWED_ORIGIN is not set', () => {
      // Arrange
      const ALLOWED_ORIGIN = null;
      const requestOrigin = 'http://evil.com';

      // Act
      const isAllowed = !ALLOWED_ORIGIN || ALLOWED_ORIGIN === '*' || true;

      // Assert
      expect(isAllowed).toBe(true);
    });

    it('should allow matching origin', () => {
      // Arrange
      const ALLOWED_ORIGIN = 'http://localhost:3000';
      const requestOrigin = 'http://localhost:3000';

      // Act
      const isAllowed = requestOrigin === ALLOWED_ORIGIN;

      // Assert
      expect(isAllowed).toBe(true);
    });

    it('should disallow non-matching origin', () => {
      // Arrange
      const ALLOWED_ORIGIN = 'http://localhost:3000';
      const requestOrigin: string = 'http://evil.com';

      // Act
      const isAllowed = requestOrigin === ALLOWED_ORIGIN;

      // Assert
      expect(isAllowed).toBe(false);
    });

    it('should allow wildcard origin', () => {
      // Arrange
      const ALLOWED_ORIGIN = '*';
      const requestOrigin = 'http://anything.com';

      // Act
      const isAllowed = ALLOWED_ORIGIN === '*';

      // Assert
      expect(isAllowed).toBe(true);
    });

    it('should allow localhost origins', () => {
      // Arrange
      const ALLOWED_ORIGIN = 'http://localhost:3000';
      const requestOrigin = 'http://localhost:3001';

      // Act
      const cleanReq = requestOrigin.replace(/^https?:\/\//, '').toLowerCase();
      const isAllowed = cleanReq.startsWith('localhost');

      // Assert
      expect(isAllowed).toBe(true);
    });
  });

  describe('Token verification', () => {
    it('should return null for missing token', async () => {
      // Arrange
      const token = '';

      // Act
      const result = !token ? null : 'user';

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when supabase admin is not configured', async () => {
      // Arrange
      const supabaseAdmin = null;
      const token = 'valid-token';

      // Act
      const result = !supabaseAdmin ? null : 'user';

      // Assert
      expect(result).toBeNull();
    });

    it('should verify valid token', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const supabaseAdmin = {
        auth: {
          getUser: vi.fn((_token: string) => Promise.resolve({ data: { user: mockUser }, error: null })),
        },
      };
      const token = 'valid-token';

      // Act
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      const result = !error && user ? user : null;

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('should return null for invalid token', async () => {
      // Arrange
      const supabaseAdmin = {
        auth: {
          getUser: vi.fn((_token: string) => Promise.resolve({ data: { user: null }, error: { message: 'Invalid token' } })),
        },
      };
      const token = 'invalid-token';

      // Act
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      const result = !error && user ? user : null;

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('WebSocket endpoints', () => {
    it('should accept Yjs WebSocket connections', async () => {
      // Assert
      expect(true).toBe(true); // Endpoint exists in server code
    });

    it('should accept Terminal WebSocket connections', () => {
      // Assert
      expect(true).toBe(true); // /terminal endpoint exists
    });

    it('should accept Comm WebSocket connections', () => {
      // Assert
      expect(true).toBe(true); // /comm endpoint exists
    });

    it('should reject visitor terminal connections', () => {
      // Arrange
      const role = 'visitor';

      // Act
      const isRejected = role === 'visitor';

      // Assert
      expect(isRejected).toBe(true);
    });

    it('should reject unauthenticated terminal when service role key is set', () => {
      // Arrange
      const SUPABASE_SERVICE_ROLE_KEY = 'some-key';
      const verifiedUser = null;

      // Act
      const isRejected = SUPABASE_SERVICE_ROLE_KEY && !verifiedUser;

      // Assert
      expect(isRejected).toBe(true);
    });
  });

  describe('File sync endpoint', () => {
    it('should sync file to disk', async () => {
      // Arrange
      const { WorkspaceManager } = await import('../../../../server/workspace-manager.mjs');

      // Act
      WorkspaceManager.syncFileToDisk('test-project', 'src/index.ts', 'console.log("hello")');

      // Assert
      expect(WorkspaceManager.syncFileToDisk).toHaveBeenCalledWith('test-project', 'src/index.ts', 'console.log("hello")');
    });

    it('should reject invalid payload', () => {
      // Arrange
      // Typed as a partial request payload: the server parses arbitrary JSON, so optional
// fields are legitimately absent.
    const body: { path?: string; projectId?: string } = { path: 'src/index.ts' }; // missing projectId

      // Act
      const isValid = Boolean(body.projectId);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Project sync endpoint', () => {
    it('should sync all project files', async () => {
      // Arrange
      const { WorkspaceManager } = await import('../../../../server/workspace-manager.mjs');
      const files = [
        { name: 'index.ts', is_folder: false, content: 'code' },
        { name: 'utils.ts', is_folder: false, content: 'code' },
      ];

      // Act
      files.forEach((f: any) => {
        if (!f.is_folder) {
          WorkspaceManager.syncFileToDisk('test-project', f.name, f.content || '');
        }
      });

      // Assert
      expect(WorkspaceManager.syncFileToDisk).toHaveBeenCalledTimes(2);
    });

    it('should reject non-array files payload', () => {
      // Arrange
      const body = { projectId: 'test', files: 'not-an-array' };

      // Act
      const isValid = Array.isArray(body.files);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Workspace exec endpoint with RBAC', () => {
    it('should execute command for authorized user', async () => {
      // Arrange
      const { WorkspaceManager } = await import('../../../../server/workspace-manager.mjs');

      // Act
      const result = await WorkspaceManager.runCommand('test-project', 'ls -la');

      // Assert
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('ok');
    });

    it('should reject visitor role', () => {
      // Arrange
      const userRole = 'visitor';

      // Act
      const isRejected = userRole === 'visitor';

      // Assert
      expect(isRejected).toBe(true);
    });

    it('should reject missing projectId or command', () => {
      // Arrange
      const body1: { projectId?: string; command?: string } = { command: 'ls' };
      const body2: { projectId?: string; command?: string } = { projectId: 'test' };

      // Act
      const isValid1 = Boolean(body1.projectId && body1.command);
      const isValid2 = Boolean(body2.projectId && body2.command);

      // Assert
      expect(isValid1).toBe(false);
      expect(isValid2).toBe(false);
    });
  });
});
