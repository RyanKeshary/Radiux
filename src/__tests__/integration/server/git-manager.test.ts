import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process execFile
// A `default` export is required: the server modules use ESM default imports of the
// CommonJS 'child_process' module, so the mock must expose both shapes.
vi.mock('child_process', () => {
  const api = {
    execFile: vi.fn((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      cb(null, 'stdout', 'stderr');
    }),
    spawn: vi.fn(() => ({ pid: 12345, kill: vi.fn() })),
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
  },
}));

// Mock workspace-manager
vi.mock('../../../../server/workspace-manager.mjs', () => ({
  WorkspaceManager: {
    getWorkspaceDir: vi.fn(() => '/tmp/test-workspace'),
    sanitizeProjectId: vi.fn((id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '') || 'default'),
  },
  getSanitizedEnv: vi.fn(() => ({ PATH: '/usr/bin', HOME: '/home/user' })),
}));

import { GitManager } from '../../../../server/git-manager.mjs';

describe('GitManager', () => {
  let execFileMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const cp = await import('child_process');
    execFileMock = cp.execFile as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('init()', () => {
    it('should initialize a git repository with main branch', async () => {
      // Arrange
      const projectId = 'test-project';
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.init(projectId);

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['init', '-b', 'main'], expect.anything(), expect.any(Function));
    });

    it('should set user name and email config after init', async () => {
      // Arrange
      const projectId = 'test-project';
      const calls: string[][] = [];
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        calls.push(args);
        cb(null, '', '');
      });

      // Act
      await GitManager.init(projectId, 'John Doe', 'john@example.com');

      // Assert
      expect(calls).toContainEqual(['config', 'user.name', 'John Doe']);
      expect(calls).toContainEqual(['config', 'user.email', 'john@example.com']);
    });

    it('should return failure when git init fails', async () => {
      // Arrange
      const projectId = 'test-project';
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(new Error('git not found'), '', 'git: command not found');
      });

      // Act
      const result = await GitManager.init(projectId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('git: command not found');
    });
  });

  describe('getStatus()', () => {
    it('should return isRepo false when not a git repo', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValue(false);

      // Act
      const result = await GitManager.getStatus('non-repo');

      // Assert
      expect(result.isRepo).toBe(false);
      expect(result.branch).toBeNull();
      expect(result.clean).toBe(true);
    });

    it('should return branch and file status for a git repo', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValue(true);
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('status')) {
          cb(null, '## main...origin/main\n M src/index.ts\n?? new-file.ts', '');
        } else if (args.includes('log')) {
          cb(null, 'abc123\tJohn Doe\t2 hours ago\tInitial commit', '');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.getStatus('test-project');

      // Assert
      expect(result.isRepo).toBe(true);
      expect(result.branch).toBe('main');
      expect(result.unstaged.length).toBe(1);
      expect(result.untracked.length).toBe(1);
      expect(result.clean).toBe(false);
    });

    it('should return staged files', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValue(true);
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('status')) {
          cb(null, '## main\nA  src/index.ts\nM  src/utils.ts', '');
        } else if (args.includes('log')) {
          cb(null, '', '');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.getStatus('test-project');

      // Assert
      expect(result.staged.length).toBe(2);
      expect(result.staged[0].status).toBe('A');
      expect(result.staged[0].description).toBe('Added');
    });

    it('should handle git command errors gracefully', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValue(true);
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('status')) {
          cb(new Error('fatal: not a git repository'), '', 'fatal: not a git repository');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.getStatus('test-project');

      // Assert
      expect(result.isRepo).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  describe('stage() and unstage()', () => {
    it('should stage all files when no files specified', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.stage('test-project');

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['add', '-A'], expect.anything(), expect.any(Function));
    });

    it('should stage specific files', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.stage('test-project', ['src/index.ts', 'src/utils.ts']);

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['add', '--', 'src/index.ts', 'src/utils.ts'], expect.anything(), expect.any(Function));
    });

    it('should unstage files', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.unstage('test-project', ['src/index.ts']);

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['reset', 'HEAD', '--', 'src/index.ts'], expect.anything(), expect.any(Function));
    });

    it('should unstage all files when no files specified', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.unstage('test-project');

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['reset', 'HEAD'], expect.anything(), expect.any(Function));
    });
  });

  describe('commit()', () => {
    it('should create a commit with message', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '[main abc123] Fix bug', '');
      });

      // Act
      const result = await GitManager.commit('test-project', 'Fix bug');

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['commit', '-m', 'Fix bug', '--author=Radiux Developer <developer@radiux.dev>'], expect.anything(), expect.any(Function));
    });

    it('should reject empty commit message', async () => {
      // Act
      const result = await GitManager.commit('test-project', '');

      // Assert
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Commit message cannot be empty');
    });

    it('should reject whitespace-only commit message', async () => {
      // Act
      const result = await GitManager.commit('test-project', '   ');

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('Branch operations', () => {
    it('should list branches', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('branch')) {
          cb(null, '* main\n  develop\n  feature/test', '');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.getBranches('test-project');

      // Assert
      expect(result.current).toBe('main');
      expect(result.branches.length).toBe(3);
      expect(result.branches[0].isCurrent).toBe(true);
    });

    it('should create a new branch', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.createBranch('test-project', 'feature/new-feature');

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['checkout', '-b', 'feature/new-feature'], expect.anything(), expect.any(Function));
    });

    it('should reject invalid branch names', async () => {
      // Act
      const result = await GitManager.createBranch('test-project', 'invalid branch!');

      // Assert
      expect(result.success).toBe(false);
      expect(result.stderr).toBe('Invalid branch name');
    });

    it('should switch branches', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.switchBranch('test-project', 'develop');

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['checkout', 'develop'], expect.anything(), expect.any(Function));
    });

    it('should delete a branch', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, '', '');
      });

      // Act
      const result = await GitManager.deleteBranch('test-project', 'feature/old');

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['branch', '-d', 'feature/old'], expect.anything(), expect.any(Function));
    });
  });

  describe('getDiff()', () => {
    it('should return diff output', async () => {
      // Arrange
      const diffOutput = 'diff --git a/file.ts b/file.ts\n+new line\n-old line';
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, diffOutput, '');
      });

      // Act
      const result = await GitManager.getDiff('test-project', 'file.ts');

      // Assert
      expect(result.success).toBe(true);
      expect(result.diff).toBe(diffOutput);
    });

    it('should return staged diff when staged=true', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(null, 'staged diff', '');
      });

      // Act
      const result = await GitManager.getDiff('test-project', null, true);

      // Assert
      expect(result.success).toBe(true);
      expect(execFileMock).toHaveBeenCalledWith('git', ['diff', '--staged'], expect.anything(), expect.any(Function));
    });
  });

  describe('getLog()', () => {
    it('should return commit history', async () => {
      // Arrange
      const logOutput = 'abc123def456\tabc123\tJohn Doe\tjohn@example.com\t2 hours ago\t2024-01-15\tFix bug\ndef456abc789\tdef456\tJane Doe\tjane@example.com\t1 day ago\t2024-01-14\tAdd feature';
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('log')) {
          cb(null, logOutput, '');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.getLog('test-project');

      // Assert
      expect(result.length).toBe(2);
      expect(result[0].hash).toBe('abc123');
      expect(result[0].author).toBe('John Doe');
      expect(result[0].message).toBe('Fix bug');
    });

    it('should return empty array on git error', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('log')) {
          cb(new Error('fatal: your current branch does not have any commits yet'), '', 'fatal');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.getLog('test-project');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('push() and pull() with token auth', () => {
    it('should push with token authentication', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('status')) {
          cb(null, '## main', '');
        } else if (args.includes('remote')) {
          cb(null, 'origin\thttps://github.com/user/repo.git (push)', '');
        } else if (args.includes('push')) {
          cb(null, 'Everything up-to-date', '');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.push('test-project', 'origin', 'main', 'ghp_test123');

      // Assert
      expect(result.success).toBe(true);
    });

    it('should mask token in output', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('status')) {
          cb(null, '## main', '');
        } else if (args.includes('remote')) {
          cb(null, 'origin\thttps://github.com/user/repo.git (push)', '');
        } else if (args.includes('push')) {
          cb(null, 'Pushed with token ghp_test123 successfully', '');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.push('test-project', 'origin', 'main', 'ghp_test123');

      // Assert
      expect(result.stdout).not.toContain('ghp_test123');
      expect(result.stdout).toContain('***');
    });

    it('should pull with token authentication', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        if (args.includes('status')) {
          cb(null, '## main', '');
        } else if (args.includes('remote')) {
          cb(null, 'origin\thttps://github.com/user/repo.git (push)', '');
        } else if (args.includes('pull')) {
          cb(null, 'Already up to date.', '');
        } else {
          cb(null, '', '');
        }
      });

      // Act
      const result = await GitManager.pull('test-project', 'origin', 'main', 'ghp_test123');

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle execFile errors gracefully', async () => {
      // Arrange
      execFileMock.mockImplementation((cmd: string, args: string[], opts: any, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb(new Error('ENOENT: no such file or directory'), '', 'ENOENT');
      });

      // Act
      const result = await GitManager.getStatus('test-project');

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle non-existent workspace', async () => {
      // Arrange
      const fs = await import('fs');
      (fs.default.existsSync as any).mockReturnValue(false);

      // Act
      const result = await GitManager.isGitRepo('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });
});
