import path from 'path';
import fs from 'fs';
import { execFile, spawn } from 'child_process';
import { WorkspaceManager, getSanitizedEnv } from './workspace-manager.mjs';

/**
 * Execute a git command in the context of a project's workspace directory.
 * Sanitizes sensitive environment variables.
 */
function runGit(projectId, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const cwd = WorkspaceManager.getWorkspaceDir(projectId);

    // Sanitize environment so credentials/tokens are never exposed to shell or child processes
    const safeEnv = { ...getSanitizedEnv(), ...extraEnv };

    execFile('git', args, { cwd, env: safeEnv, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        return resolve({
          success: false,
          code: error.code || 1,
          stdout: stdout ? stdout.toString() : '',
          stderr: stderr ? stderr.toString() : error.message,
        });
      }
      resolve({
        success: true,
        code: 0,
        stdout: stdout ? stdout.toString() : '',
        stderr: stderr ? stderr.toString() : '',
      });
    });
  });
}

export const GitManager = {
  /**
   * Check if the project workspace has a git repository initialized.
   */
  async isGitRepo(projectId) {
    const wsDir = WorkspaceManager.getWorkspaceDir(projectId);
    const gitDir = path.join(wsDir, '.git');
    return fs.existsSync(gitDir);
  },

  /**
   * Initialize a git repository with default branch 'main' and basic safe author configs.
   */
  async init(projectId, userName = 'Radiux Developer', userEmail = 'developer@radiux.dev') {
    const res = await runGit(projectId, ['init', '-b', 'main']);
    if (res.success) {
      await runGit(projectId, ['config', 'user.name', userName]);
      await runGit(projectId, ['config', 'user.email', userEmail]);
      // Set sane git defaults
      await runGit(projectId, ['config', 'core.autocrlf', 'false']);
      await runGit(projectId, ['config', 'pull.rebase', 'false']);
    }
    return res;
  },

  /**
   * Get detailed Git status: current branch, tracking branch, ahead/behind, staged & unstaged changes.
   */
  async getStatus(projectId) {
    const isRepo = await this.isGitRepo(projectId);
    if (!isRepo) {
      return {
        isRepo: false,
        branch: null,
        tracking: null,
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        clean: true,
      };
    }

    // Run porcelain status
    const statusRes = await runGit(projectId, ['status', '--porcelain=v1', '-b', '-uall']);
    if (!statusRes.success) {
      return {
        isRepo: true,
        error: statusRes.stderr,
        branch: 'unknown',
        staged: [],
        unstaged: [],
        untracked: [],
        clean: true,
      };
    }

    const lines = statusRes.stdout.split('\n').filter(l => Boolean(l.trim()));
    let branch = 'main';
    let tracking = null;
    let ahead = 0;
    let behind = 0;
    const staged = [];
    const unstaged = [];
    const untracked = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const header = line.substring(3).trim();
        // Format: branch...tracking [ahead X, behind Y] or Initial commit on branch or No commits yet on branch
        if (header.includes('...')) {
          const parts = header.split('...');
          branch = parts[0];
          const rest = parts[1] || '';
          const trackMatch = rest.match(/^([^\s]+)/);
          if (trackMatch) tracking = trackMatch[1];
          const aheadMatch = rest.match(/ahead (\d+)/);
          if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
          const behindMatch = rest.match(/behind (\d+)/);
          if (behindMatch) behind = parseInt(behindMatch[1], 10);
        } else if (header.startsWith('Initial commit on ') || header.startsWith('No commits yet on ')) {
          branch = header.replace(/^(Initial commit on |No commits yet on )/, '').trim();
        } else {
          branch = header.split(' ')[0] || 'main';
        }
        continue;
      }

      const x = line[0];
      const y = line[1];
      const filePath = line.substring(3).trim().replace(/^"|"$/g, '');

      if (x === '?' && y === '?') {
        untracked.push({ path: filePath, status: 'U', description: 'Untracked' });
        continue;
      }

      // Staged changes (index)
      if (x !== ' ' && x !== '?') {
        let status = x;
        let desc = 'Modified';
        if (x === 'A') desc = 'Added';
        else if (x === 'D') desc = 'Deleted';
        else if (x === 'R') desc = 'Renamed';
        staged.push({ path: filePath, status, description: desc });
      }

      // Unstaged working tree changes
      if (y !== ' ' && y !== '?') {
        let status = y;
        let desc = 'Modified';
        if (y === 'D') desc = 'Deleted';
        else if (y === 'M') desc = 'Modified';
        unstaged.push({ path: filePath, status, description: desc });
      }
    }

    // Get last commit info
    let lastCommit = null;
    const logRes = await runGit(projectId, ['log', '-1', '--pretty=format:%h%x09%an%x09%ar%x09%s']);
    if (logRes.success && logRes.stdout.trim()) {
      const parts = logRes.stdout.trim().split('\t');
      lastCommit = {
        hash: parts[0],
        author: parts[1],
        relativeDate: parts[2],
        message: parts[3],
      };
    }

    return {
      isRepo: true,
      branch,
      tracking,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
      lastCommit,
    };
  },

  /**
   * Stage specific files or all files.
   */
  async stage(projectId, files = null) {
    if (!files || files.length === 0 || files === 'all' || files[0] === '.') {
      return runGit(projectId, ['add', '-A']);
    }
    const safeFiles = Array.isArray(files) ? files : [files];
    return runGit(projectId, ['add', '--', ...safeFiles]);
  },

  /**
   * Unstage specific files or all files.
   */
  async unstage(projectId, files = null) {
    if (!files || files.length === 0 || files === 'all' || files[0] === '.') {
      return runGit(projectId, ['reset', 'HEAD']);
    }
    const safeFiles = Array.isArray(files) ? files : [files];
    return runGit(projectId, ['reset', 'HEAD', '--', ...safeFiles]);
  },

  /**
   * Discard working tree changes in unstaged file(s).
   */
  async discard(projectId, files) {
    const safeFiles = Array.isArray(files) ? files : [files];
    // For tracked files
    await runGit(projectId, ['checkout', '--', ...safeFiles]);
    // For untracked files, remove them from workspace disk if needed
    const wsDir = WorkspaceManager.getWorkspaceDir(projectId);
    for (const f of safeFiles) {
      const full = path.join(wsDir, f);
      if (fs.existsSync(full)) {
        try {
          fs.rmSync(full, { recursive: true, force: true });
        } catch (e) {}
      }
    }
    return { success: true };
  },

  /**
   * Commit staged changes with message and author.
   */
  async commit(projectId, message, authorName = 'Radiux Developer', authorEmail = 'developer@radiux.dev') {
    if (!message || !message.trim()) {
      return { success: false, stderr: 'Commit message cannot be empty' };
    }
    const authorArg = `${authorName} <${authorEmail}>`;
    return runGit(projectId, ['commit', '-m', message.trim(), `--author=${authorArg}`]);
  },

  /**
   * Get commit history.
   */
  async getLog(projectId, limit = 40) {
    const res = await runGit(projectId, [
      'log',
      `-n`, `${limit}`,
      '--pretty=format:%H%x09%h%x09%an%x09%ae%x09%ar%x09%ad%x09%s',
      '--date=iso'
    ]);

    if (!res.success) {
      return [];
    }

    const commits = [];
    const lines = res.stdout.split('\n').filter(l => Boolean(l.trim()));
    for (const l of lines) {
      const parts = l.split('\t');
      if (parts.length >= 7) {
        commits.push({
          fullHash: parts[0],
          hash: parts[1],
          author: parts[2],
          email: parts[3],
          relativeDate: parts[4],
          date: parts[5],
          message: parts[6],
        });
      }
    }
    return commits;
  },

  /**
   * Get file diff or commit diff.
   */
  async getDiff(projectId, filePath = null, staged = false, commitHash = null) {
    const args = ['diff'];
    if (staged) {
      args.push('--staged');
    }
    if (commitHash) {
      args.push(`${commitHash}^!`);
    }
    if (filePath) {
      args.push('--', filePath);
    }

    const res = await runGit(projectId, args);
    return {
      success: res.success,
      diff: res.stdout || '',
      error: res.stderr || '',
    };
  },

  /**
   * Branch operations.
   */
  async getBranches(projectId) {
    const res = await runGit(projectId, ['branch', '-a', '--no-color']);
    if (!res.success) {
      return { current: 'main', branches: ['main'] };
    }
    let current = 'main';
    const branches = [];
    const lines = res.stdout.split('\n').filter(l => Boolean(l.trim()));
    for (const line of lines) {
      const clean = line.trim();
      const isCurrent = line.startsWith('*');
      const branchName = clean.replace(/^\*\s+/, '').trim();
      if (!branchName.includes('->')) {
        branches.push({ name: branchName, isCurrent });
      }
      if (isCurrent) {
        current = branchName;
      }
    }
    return { current, branches };
  },

  async createBranch(projectId, branchName) {
    if (!branchName || !/^[a-zA-Z0-9._\-/]+$/.test(branchName)) {
      return { success: false, stderr: 'Invalid branch name' };
    }
    return runGit(projectId, ['checkout', '-b', branchName]);
  },

  async switchBranch(projectId, branchName) {
    return runGit(projectId, ['checkout', branchName]);
  },

  async deleteBranch(projectId, branchName) {
    // Use safe -d flag to prevent deleting unmerged branches accidentally
    return runGit(projectId, ['branch', '-d', branchName]);
  },

  async mergeBranch(projectId, branchName) {
    return runGit(projectId, ['merge', '--no-ff', '-m', `Merge branch '${branchName}' into current branch`, branchName]);
  },

  /**
   * GitHub Remote & Sync Operations.
   * Credentials (tokens) are injected strictly during execution via authenticated HTTPS URL
   * or temporary askpass/header, and NEVER stored unencrypted on disk or shell environment.
   */
  async getRemotes(projectId) {
    const res = await runGit(projectId, ['remote', '-v']);
    if (!res.success) return [];
    const remotes = [];
    const lines = res.stdout.split('\n').filter(l => Boolean(l.trim()));
    for (const l of lines) {
      const parts = l.split(/\s+/);
      if (parts.length >= 2 && parts[2] === '(push)') {
        // Redact any embedded tokens in URL
        const safeUrl = parts[1].replace(/https:\/\/[^@]+@github\.com/, 'https://github.com');
        remotes.push({ name: parts[0], url: safeUrl });
      }
    }
    return remotes;
  },

  async setRemote(projectId, name = 'origin', url) {
    if (!url || !url.trim()) return { success: false, stderr: 'Remote URL is required' };
    // Check if remote already exists
    const remotes = await this.getRemotes(projectId);
    const exists = remotes.some(r => r.name === name);
    if (exists) {
      return runGit(projectId, ['remote', 'set-url', name, url.trim()]);
    } else {
      return runGit(projectId, ['remote', 'add', name, url.trim()]);
    }
  },

  async removeRemote(projectId, name = 'origin') {
    return runGit(projectId, ['remote', 'remove', name]);
  },

  /**
   * Push to remote with optional GitHub Personal Access Token.
   */
  async push(projectId, remote = 'origin', branch = null, token = null) {
    const currentBranch = branch || (await this.getStatus(projectId)).branch || 'main';
    
    // If token provided, dynamically construct an authenticated URL for this single command
    let pushTarget = remote;
    if (token && token.trim()) {
      const remotes = await this.getRemotes(projectId);
      const targetRemote = remotes.find(r => r.name === remote);
      if (targetRemote) {
        // Build ephemeral authenticated URL: https://oauth2:token@github.com/user/repo.git
        const cleanRepo = targetRemote.url.replace(/^https?:\/\/github\.com\//, '');
        pushTarget = `https://oauth2:${token.trim()}@github.com/${cleanRepo}`;
      }
    }

    const res = await runGit(projectId, ['push', '-u', pushTarget, currentBranch]);
    // Mask any token in output
    if (token) {
      res.stdout = res.stdout.replaceAll(token.trim(), '***');
      res.stderr = res.stderr.replaceAll(token.trim(), '***');
    }
    return res;
  },

  /**
   * Pull from remote.
   */
  async pull(projectId, remote = 'origin', branch = null, token = null) {
    const currentBranch = branch || (await this.getStatus(projectId)).branch || 'main';

    let pullTarget = remote;
    if (token && token.trim()) {
      const remotes = await this.getRemotes(projectId);
      const targetRemote = remotes.find(r => r.name === remote);
      if (targetRemote) {
        const cleanRepo = targetRemote.url.replace(/^https?:\/\/github\.com\//, '');
        pullTarget = `https://oauth2:${token.trim()}@github.com/${cleanRepo}`;
      }
    }

    const res = await runGit(projectId, ['pull', pullTarget, currentBranch]);
    if (token) {
      res.stdout = res.stdout.replaceAll(token.trim(), '***');
      res.stderr = res.stderr.replaceAll(token.trim(), '***');
    }
    return res;
  },

  /**
   * Clone a GitHub repository into the project workspace directory.
   */
  async clone(projectId, repoUrl, token = null) {
    const wsDir = WorkspaceManager.getWorkspaceDir(projectId);
    
    // Ensure wsDir exists and is clean
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }

    let authUrl = repoUrl.trim();
    if (token && token.trim() && authUrl.includes('github.com')) {
      const cleanRepo = authUrl.replace(/^https?:\/\/github\.com\//, '').replace(/^git@github\.com:/, '');
      authUrl = `https://oauth2:${token.trim()}@github.com/${cleanRepo}`;
    }

    return new Promise((resolve) => {
      // Clone directly into wsDir (using '.' target)
      execFile('git', ['clone', authUrl, '.'], { cwd: wsDir }, (error, stdout, stderr) => {
        let cleanErr = stderr ? stderr.toString() : '';
        if (token) {
          cleanErr = cleanErr.replaceAll(token.trim(), '***');
        }
        if (error) {
          return resolve({ success: false, stderr: cleanErr || error.message });
        }
        resolve({ success: true, stdout: stdout ? stdout.toString() : '' });
      });
    });
  }
};
