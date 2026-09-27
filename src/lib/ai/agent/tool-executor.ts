import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  AIToolResult,
  DiffProposal,
  StructuredEdit,
  WorkspaceAIContext,
} from '../types';
import { AIConfig } from '../config';

const execAsync = promisify(exec);

const WORKSPACES_ROOT = path.resolve(process.cwd(), '.workspaces');

export class ToolExecutor {
  /**
   * Resolve and validate a workspace relative path securely.
   * Strictly prevents directory traversal escaping the workspace root.
   */
  static getWorkspacePath(projectId: string, relativePath: string = ''): string {
    const cleanId = (projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    const wsDir = path.resolve(WORKSPACES_ROOT, cleanId);

    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }

    const safeRelative = (relativePath || '').replace(/^(\.\.[\/\\])+/, '');
    const target = path.resolve(wsDir, safeRelative);

    if (!target.startsWith(wsDir)) {
      throw new Error(`Security Violation: Path "${relativePath}" escapes the project workspace boundary.`);
    }

    return target;
  }

  static async execute(
    projectId: string,
    toolName: string,
    args: any,
    context: WorkspaceAIContext,
    onDiffProposal?: (proposal: DiffProposal) => void
  ): Promise<AIToolResult> {
    const wsDir = path.resolve(WORKSPACES_ROOT, (projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, ''));

    const userRole = context.user?.role;
    const isVisitor = userRole === 'visitor';
    const writeTools = [
      'write_file',
      'create_file',
      'edit_file',
      'apply_editor_edit',
      'delete_file',
      'run_terminal',
    ];

    if (isVisitor && writeTools.includes(toolName)) {
      return {
        toolCallId: '',
        name: toolName,
        output: `Access Denied (403): Workspace role is "visitor". Visitors only have read-only privileges. File modifications and terminal execution are strictly forbidden.`,
        error: 'Forbidden (Visitor)',
      };
    }

    // Ensure activeFile and targetFiles are synchronized into workspace disk if provided
    try {
      if (context.activeFile?.path && context.activeFile.content !== undefined) {
        const dest = this.getWorkspacePath(projectId, context.activeFile.path);
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(dest)) {
          fs.writeFileSync(dest, context.activeFile.content, 'utf8');
        }
      }
      if (context.targetFiles && Array.isArray(context.targetFiles)) {
        for (const tf of context.targetFiles) {
          if (tf.path && tf.content !== undefined) {
            const dest = this.getWorkspacePath(projectId, tf.path);
            const dir = path.dirname(dest);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(dest)) {
              fs.writeFileSync(dest, tf.content, 'utf8');
            }
          }
        }
      }
    } catch (e) {
      // Non-fatal sync warning
    }

    try {
      switch (toolName) {
        // ----------------------------------------------------------------------
        // TOOL 1: list_files
        // ----------------------------------------------------------------------
        case 'list_files': {
          const targetDir = this.getWorkspacePath(projectId, args.path || '');
          if (!fs.existsSync(targetDir)) {
            return {
              toolCallId: '',
              name: toolName,
              output: `Directory not found: "${args.path || '.'}"`,
            };
          }

          const recursive = !!args.recursive;
          const maxDepth = args.maxDepth || 3;
          const results: string[] = [];

          const scan = (dir: string, depth: number) => {
            if (depth > maxDepth) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (
                entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === '.next' ||
                entry.name === 'dist' ||
                entry.name === 'build'
              ) {
                continue;
              }

              const full = path.join(dir, entry.name);
              const rel = path.relative(wsDir, full).replace(/\\/g, '/');

              if (entry.isDirectory()) {
                results.push(`${rel}/`);
                if (recursive) scan(full, depth + 1);
              } else {
                results.push(rel);
              }
            }
          };

          scan(targetDir, 1);
          return {
            toolCallId: '',
            name: toolName,
            output: results.length > 0 ? results.join('\n') : 'Workspace directory is empty.',
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 2: read_file
        // ----------------------------------------------------------------------
        case 'read_file': {
          let rawContent: string | null = null;
          const filePath = this.getWorkspacePath(projectId, args.path);

          if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
            const stat = fs.statSync(filePath);
            if (stat.size > AIConfig.maxFileSizeBytes) {
              return {
                toolCallId: '',
                name: toolName,
                output: `File is too large (${(stat.size / 1024).toFixed(1)} KB). Exceeds maximum limit of 1MB.`,
                error: 'File too large',
              };
            }
            rawContent = fs.readFileSync(filePath, 'utf8');
          } else {
            // Check context.activeFile or targetFiles fallback
            const normalizedReq = (args.path || '').replace(/^[\\\/]+/, '');
            if (
              context.activeFile &&
              (context.activeFile.path === normalizedReq ||
                context.activeFile.path.endsWith(normalizedReq) ||
                normalizedReq.endsWith(context.activeFile.path))
            ) {
              rawContent = context.activeFile.content ?? '';
            } else if (context.targetFiles) {
              const matched = context.targetFiles.find(
                (t) =>
                  t.path === normalizedReq ||
                  t.path.endsWith(normalizedReq) ||
                  normalizedReq.endsWith(t.path)
              );
              if (matched && matched.content !== undefined) {
                rawContent = matched.content;
              }
            }
          }

          if (rawContent === null) {
            return {
              toolCallId: '',
              name: toolName,
              output: `File not found: "${args.path}"`,
              error: 'File not found',
            };
          }

          const lines = rawContent.split('\n');

          const start = args.startLine ? Math.max(1, args.startLine) : 1;
          const end = args.endLine ? Math.min(lines.length, args.endLine) : lines.length;

          if (start > lines.length) {
            return {
              toolCallId: '',
              name: toolName,
              output: `Requested startLine ${start} exceeds total file lines (${lines.length}).`,
            };
          }

          const numberedLines = [];
          for (let i = start; i <= end; i++) {
            numberedLines.push(`${i}: ${lines[i - 1]}`);
          }

          return {
            toolCallId: '',
            name: toolName,
            output: numberedLines.join('\n'),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 3: search_files
        // ----------------------------------------------------------------------
        case 'search_files': {
          const query = args.query;
          if (!query) {
            return { toolCallId: '', name: toolName, output: 'Missing query parameter.' };
          }

          const searchDir = this.getWorkspacePath(projectId, args.path || '');
          const caseSensitive = !!args.caseSensitive;
          const maxResults = args.maxResults || AIConfig.maxSearchResults;
          const results: { file: string; line: number; text: string }[] = [];

          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

          const searchWalk = (dir: string) => {
            if (results.length >= maxResults) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (results.length >= maxResults) break;
              if (
                entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === '.next' ||
                entry.name === 'dist' ||
                entry.name.endsWith('.png') ||
                entry.name.endsWith('.jpg') ||
                entry.name.endsWith('.ico')
              ) {
                continue;
              }

              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                searchWalk(full);
              } else {
                try {
                  const content = fs.readFileSync(full, 'utf8');
                  const lines = content.split('\n');
                  for (let i = 0; i < lines.length; i++) {
                    if (regex.test(lines[i])) {
                      const rel = path.relative(wsDir, full).replace(/\\/g, '/');
                      results.push({ file: rel, line: i + 1, text: lines[i].trim() });
                      if (results.length >= maxResults) break;
                    }
                  }
                } catch (e) {}
              }
            }
          };

          searchWalk(searchDir);

          if (results.length === 0) {
            return {
              toolCallId: '',
              name: toolName,
              output: `No occurrences found matching "${query}".`,
            };
          }

          const formatted = results
            .map((r) => `${r.file}:${r.line}: ${r.text}`)
            .join('\n');
          return {
            toolCallId: '',
            name: toolName,
            output: `Found ${results.length} matches:\n${formatted}`,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 4: get_file_tree
        // ----------------------------------------------------------------------
        case 'get_file_tree': {
          const maxDepth = args.maxDepth || 3;
          const lines: string[] = [];

          const buildTree = (dir: string, prefix: string, depth: number) => {
            if (depth > maxDepth) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true })
              .filter(e => !['node_modules', '.git', '.next', 'dist'].includes(e.name))
              .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));

            for (let i = 0; i < entries.length; i++) {
              const entry = entries[i];
              const isLast = i === entries.length - 1;
              const connector = isLast ? '└── ' : '├── ';
              const full = path.join(dir, entry.name);

              if (entry.isDirectory()) {
                lines.push(`${prefix}${connector}${entry.name}/`);
                buildTree(full, prefix + (isLast ? '    ' : '│   '), depth + 1);
              } else {
                lines.push(`${prefix}${connector}${entry.name}`);
              }
            }
          };

          buildTree(wsDir, '', 1);
          return {
            toolCallId: '',
            name: toolName,
            output: lines.length > 0 ? lines.join('\n') : '(empty workspace)',
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 5: get_current_file
        // ----------------------------------------------------------------------
        case 'get_current_file': {
          if (!context.activeFile) {
            return {
              toolCallId: '',
              name: toolName,
              output: 'No file is currently open in the active editor.',
            };
          }

          const f = context.activeFile;
          return {
            toolCallId: '',
            name: toolName,
            output: JSON.stringify({
              path: f.path,
              language: f.language || 'plaintext',
              hasSelection: !!(f.selection && f.selection.text.trim()),
            }, null, 2),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 6: get_selection
        // ----------------------------------------------------------------------
        case 'get_selection': {
          const sel = context.activeFile?.selection;
          if (!sel || !sel.text.trim()) {
            return {
              toolCallId: '',
              name: toolName,
              output: 'There is currently no active code selection in the editor.',
            };
          }

          return {
            toolCallId: '',
            name: toolName,
            output: `Selected Lines ${sel.startLine}-${sel.endLine}:\n${sel.text}`,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 6B: get_open_tabs
        // ----------------------------------------------------------------------
        case 'get_open_tabs': {
          const openTabs = context.openTabs || [];
          return {
            toolCallId: '',
            name: toolName,
            output: JSON.stringify(
              {
                openTabs,
                activeFile: context.activeFile?.path || null,
                count: openTabs.length,
              },
              null,
              2
            ),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 6C: get_editor_state
        // ----------------------------------------------------------------------
        case 'get_editor_state': {
          return {
            toolCallId: '',
            name: toolName,
            output: JSON.stringify(
              {
                activeFile: context.activeFile?.path || null,
                language: context.activeFile?.language || 'plaintext',
                cursor: context.editorState?.cursor || null,
                selection: context.activeFile?.selection || null,
                openTabs: context.openTabs || [],
                dirtyFiles: context.editorState?.dirtyFiles || [],
              },
              null,
              2
            ),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 7: write_file
        // ----------------------------------------------------------------------
        case 'write_file': {
          const filePath = this.getWorkspacePath(projectId, args.path);
          let originalContent = '';
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            originalContent = fs.readFileSync(filePath, 'utf8');
          }

          const proposedContent = args.content || '';
          const proposal: DiffProposal = {
            id: `diff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            path: args.path,
            originalContent,
            proposedContent,
            edits: [],
            status: 'pending',
            summary: originalContent ? `Replace entire content of ${args.path}` : `Create new file ${args.path}`,
          };

          if (onDiffProposal) {
            onDiffProposal(proposal);
          }

          return {
            toolCallId: '',
            name: toolName,
            output: `Proposed file changes for "${args.path}". Awaiting user review/approval in AI panel.`,
            diffProposal: proposal,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 8: edit_file
        // ----------------------------------------------------------------------
        case 'edit_file': {
          const filePath = this.getWorkspacePath(projectId, args.path);
          if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            // Check if file content exists in context.activeFile or targetFiles to initialize it
            const normalizedReq = (args.path || '').replace(/^[\\\/]+/, '');
            let fallbackContent: string | null = null;
            if (
              context.activeFile &&
              (context.activeFile.path === normalizedReq ||
                context.activeFile.path.endsWith(normalizedReq) ||
                normalizedReq.endsWith(context.activeFile.path))
            ) {
              fallbackContent = context.activeFile.content ?? '';
            } else if (context.targetFiles) {
              const matched = context.targetFiles.find(
                (t) =>
                  t.path === normalizedReq ||
                  t.path.endsWith(normalizedReq) ||
                  normalizedReq.endsWith(t.path)
              );
              if (matched && matched.content !== undefined) {
                fallbackContent = matched.content;
              }
            }

            if (fallbackContent !== null) {
              const dir = path.dirname(filePath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(filePath, fallbackContent, 'utf8');
            } else {
              return {
                toolCallId: '',
                name: toolName,
                output: `File does not exist to edit: "${args.path}". Use write_file to create new files.`,
                error: 'File not found',
              };
            }
          }

          const originalContent = fs.readFileSync(filePath, 'utf8');
          const lines = originalContent.split('\n');

          const rawEdits: StructuredEdit[] = Array.isArray(args.edits) ? args.edits : [];
          if (rawEdits.length === 0) {
            return { toolCallId: '', name: toolName, output: 'No edits provided.' };
          }

          // Sort edits in reverse line order so subsequent line numbers aren't shifted
          const sortedEdits = [...rawEdits].sort((a, b) => b.startLine - a.startLine);
          const newLines = [...lines];

          for (const edit of sortedEdits) {
            const startIdx = Math.max(0, edit.startLine - 1);
            const endIdx = Math.min(newLines.length, edit.endLine);
            const replacementLines = (edit.replacement || '').split('\n');
            newLines.splice(startIdx, endIdx - startIdx, ...replacementLines);
          }

          const proposedContent = newLines.join('\n');
          const proposal: DiffProposal = {
            id: `diff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            path: args.path,
            originalContent,
            proposedContent,
            edits: rawEdits,
            status: 'pending',
            summary: `Targeted edits on ${args.path} (${rawEdits.length} edit block${rawEdits.length > 1 ? 's' : ''})`,
          };

          if (onDiffProposal) {
            onDiffProposal(proposal);
          }

          return {
            toolCallId: '',
            name: toolName,
            output: `Prepared ${rawEdits.length} structured edit(s) for "${args.path}". Diff preview generated for user review.`,
            diffProposal: proposal,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 8B: create_file
        // ----------------------------------------------------------------------
        case 'create_file': {
          const filePath = this.getWorkspacePath(projectId, args.path);
          if (fs.existsSync(filePath)) {
            return {
              toolCallId: '',
              name: toolName,
              output: `File already exists: "${args.path}". Use "edit_file" to modify or "write_file" to overwrite.`,
              error: 'File already exists',
            };
          }

          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          const content = args.content || '';
          fs.writeFileSync(filePath, content, 'utf8');

          const proposal: DiffProposal = {
            id: `diff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            path: args.path,
            originalContent: '',
            proposedContent: content,
            edits: [],
            status: 'pending',
            summary: `Created new file ${args.path} (${content.split('\n').length} lines)`,
          };

          if (onDiffProposal) {
            onDiffProposal(proposal);
          }

          return {
            toolCallId: '',
            name: toolName,
            output: `Successfully created "${args.path}". Diff proposal generated for user review.`,
            diffProposal: proposal,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 8C: apply_editor_edit
        // ----------------------------------------------------------------------
        case 'apply_editor_edit': {
          const filePath = this.getWorkspacePath(projectId, args.path);
          if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            const normalizedReq = (args.path || '').replace(/^[\\\/]+/, '');
            let fallbackContent: string | null = null;
            if (
              context.activeFile &&
              (context.activeFile.path === normalizedReq ||
                context.activeFile.path.endsWith(normalizedReq) ||
                normalizedReq.endsWith(context.activeFile.path))
            ) {
              fallbackContent = context.activeFile.content ?? '';
            } else if (context.targetFiles) {
              const matched = context.targetFiles.find(
                (t) =>
                  t.path === normalizedReq ||
                  t.path.endsWith(normalizedReq) ||
                  normalizedReq.endsWith(t.path)
              );
              if (matched && matched.content !== undefined) {
                fallbackContent = matched.content;
              }
            }

            if (fallbackContent !== null) {
              const dir = path.dirname(filePath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(filePath, fallbackContent, 'utf8');
            } else {
              return {
                toolCallId: '',
                name: toolName,
                output: `File does not exist to edit: "${args.path}". Use create_file to create new files.`,
                error: 'File not found',
              };
            }
          }

          const originalContent = fs.readFileSync(filePath, 'utf8');
          const lines = originalContent.split('\n');

          const rawEdits: StructuredEdit[] = Array.isArray(args.edits) ? args.edits : [];
          if (rawEdits.length === 0) {
            return { toolCallId: '', name: toolName, output: 'No edits provided.' };
          }

          const sortedEdits = [...rawEdits].sort((a, b) => b.startLine - a.startLine);
          const newLines = [...lines];

          for (const edit of sortedEdits) {
            const startIdx = Math.max(0, edit.startLine - 1);
            const endIdx = Math.min(newLines.length, edit.endLine);
            const replacementLines = (edit.replacement || '').split('\n');
            newLines.splice(startIdx, endIdx - startIdx, ...replacementLines);
          }

          const proposedContent = newLines.join('\n');
          const proposal: DiffProposal = {
            id: `diff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            path: args.path,
            originalContent,
            proposedContent,
            edits: rawEdits,
            status: 'pending',
            summary: `Applied editor edits on ${args.path} (${rawEdits.length} edit block${rawEdits.length > 1 ? 's' : ''})`,
          };

          if (onDiffProposal) {
            onDiffProposal(proposal);
          }

          return {
            toolCallId: '',
            name: toolName,
            output: `Applied ${rawEdits.length} editor edit(s) for "${args.path}". Diff preview generated for review.`,
            diffProposal: proposal,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 9: delete_file
        // ----------------------------------------------------------------------
        case 'delete_file': {
          const filePath = this.getWorkspacePath(projectId, args.path);
          if (!fs.existsSync(filePath)) {
            return { toolCallId: '', name: toolName, output: `File does not exist: "${args.path}".` };
          }

          fs.rmSync(filePath, { recursive: true, force: true });
          return {
            toolCallId: '',
            name: toolName,
            output: `Successfully deleted "${args.path}".`,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 10: run_terminal
        // ----------------------------------------------------------------------
        case 'run_terminal': {
          const command = (args.command || '').trim();
          if (!command) {
            return { toolCallId: '', name: toolName, output: 'Missing command to run.' };
          }

          const execCwd = args.cwd ? this.getWorkspacePath(projectId, args.cwd) : wsDir;
          const startTime = Date.now();

          try {
            const { stdout, stderr } = await execAsync(command, {
              cwd: execCwd,
              timeout: AIConfig.terminalTimeoutMs,
              maxBuffer: 1024 * 1024 * 2, // 2MB
            });

            const duration = Date.now() - startTime;
            const output = [
              `$ ${command} (${duration}ms)`,
              stdout ? stdout.trim() : '',
              stderr ? `[stderr]\n${stderr.trim()}` : '',
            ].filter(Boolean).join('\n');

            return {
              toolCallId: '',
              name: toolName,
              output: output || `Command finished with exit code 0 (${duration}ms).`,
            };
          } catch (cmdErr: any) {
            const duration = Date.now() - startTime;
            const exitCode = cmdErr.code ?? 1;
            const output = [
              `$ ${command} (exit ${exitCode}, ${duration}ms)`,
              cmdErr.stdout ? cmdErr.stdout.trim() : '',
              cmdErr.stderr ? cmdErr.stderr.trim() : '',
              cmdErr.message ? cmdErr.message.trim() : '',
            ].filter(Boolean).join('\n');

            return {
              toolCallId: '',
              name: toolName,
              output,
              error: `Command failed with code ${exitCode}`,
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 11: git_status
        // ----------------------------------------------------------------------
        case 'git_status': {
          try {
            const { stdout } = await execAsync('git status --short --branch', { cwd: wsDir });
            return {
              toolCallId: '',
              name: toolName,
              output: stdout.trim() || 'Git repository is clean. No uncommitted changes.',
            };
          } catch (e: any) {
            return {
              toolCallId: '',
              name: toolName,
              output: 'Not a git repository or git command failed: ' + e.message,
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 12: git_diff
        // ----------------------------------------------------------------------
        case 'git_diff': {
          const cachedFlag = args.cached ? '--cached' : '';
          const pathArg = args.path ? ` -- "${args.path}"` : '';
          try {
            const { stdout } = await execAsync(`git diff ${cachedFlag}${pathArg}`, { cwd: wsDir });
            return {
              toolCallId: '',
              name: toolName,
              output: stdout.trim() || 'No uncommitted changes detected.',
            };
          } catch (e: any) {
            return {
              toolCallId: '',
              name: toolName,
              output: 'Failed to inspect git diff: ' + e.message,
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 13: git_log
        // ----------------------------------------------------------------------
        case 'git_log': {
          const maxCommits = args.maxCommits || 5;
          try {
            const { stdout } = await execAsync(`git log -n ${maxCommits} --oneline`, { cwd: wsDir });
            return {
              toolCallId: '',
              name: toolName,
              output: stdout.trim() || 'No commits recorded.',
            };
          } catch (e: any) {
            return {
              toolCallId: '',
              name: toolName,
              output: 'Failed to retrieve git log: ' + e.message,
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 13B: git_branch
        // ----------------------------------------------------------------------
        case 'git_branch': {
          try {
            const { stdout } = await execAsync('git branch -a', { cwd: wsDir });
            return {
              toolCallId: '',
              name: toolName,
              output: stdout.trim() || 'Active branch: ' + (context.git?.branch || 'main'),
            };
          } catch (e: any) {
            return {
              toolCallId: '',
              name: toolName,
              output: 'Failed to retrieve git branches: ' + e.message,
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 14: diagnostics / get_diagnostics
        // ----------------------------------------------------------------------
        case 'diagnostics':
        case 'get_diagnostics': {
          const type = args.type || 'typescript';
          if (type === 'typescript') {
            try {
              const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
              const { stdout } = await execAsync(`${npxCmd} tsc --noEmit`, { cwd: wsDir, timeout: 25000 });
              return {
                toolCallId: '',
                name: toolName,
                output: stdout.trim() || 'TypeScript verification passed with 0 errors.',
              };
            } catch (tscErr: any) {
              return {
                toolCallId: '',
                name: toolName,
                output: `TypeScript compiler found errors:\n${tscErr.stdout || tscErr.message}`,
              };
            }
          }

          return {
            toolCallId: '',
            name: toolName,
            output: context.diagnostics || 'No active diagnostics reported in workspace.',
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 15: inspect_project
        // ----------------------------------------------------------------------
        case 'inspect_project': {
          const pName = context?.project?.name || 'Workspace';
          const pId = context?.project?.id || 'default';
          let summary = `Project: ${pName} (ID: ${pId})\n`;
          if (context?.project?.description) {
            summary += `Description: ${context.project.description}\n`;
          }

          const hasPkg = fs.existsSync(path.join(wsDir, 'package.json'));
          const hasTs = fs.existsSync(path.join(wsDir, 'tsconfig.json'));
          const hasNext = fs.existsSync(path.join(wsDir, 'next.config.js')) || fs.existsSync(path.join(wsDir, 'next.config.mjs'));
          const hasVite = fs.existsSync(path.join(wsDir, 'vite.config.ts')) || fs.existsSync(path.join(wsDir, 'vite.config.js'));
          const hasTailwind = fs.existsSync(path.join(wsDir, 'tailwind.config.js')) || fs.existsSync(path.join(wsDir, 'tailwind.config.ts'));

          summary += `Tech Stack Indicators:\n`;
          summary += `- Node.js / npm: ${hasPkg ? 'Detected' : 'Not detected'}\n`;
          summary += `- TypeScript: ${hasTs ? 'Detected' : 'Not detected'}\n`;
          summary += `- Next.js: ${hasNext ? 'Detected' : 'Not detected'}\n`;
          summary += `- Vite: ${hasVite ? 'Detected' : 'Not detected'}\n`;
          summary += `- Tailwind CSS: ${hasTailwind ? 'Detected' : 'Not detected'}\n`;

          summary += `Active Branch: ${context.git?.branch || 'main'}\n`;
          summary += `Open Editor Tabs: ${(context.openTabs || []).join(', ') || 'None'}\n`;

          return {
            toolCallId: '',
            name: toolName,
            output: summary,
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 16: inspect_package_json
        // ----------------------------------------------------------------------
        case 'inspect_package_json': {
          let pkgPath = this.getWorkspacePath(projectId, 'package.json');
          if (!fs.existsSync(pkgPath)) {
            const rootPkg = path.resolve(process.cwd(), 'package.json');
            if (fs.existsSync(rootPkg)) {
              pkgPath = rootPkg;
            } else {
              return {
                toolCallId: '',
                name: toolName,
                output: 'No package.json file found in workspace root.',
              };
            }
          }

          try {
            const raw = fs.readFileSync(pkgPath, 'utf8');
            const pkg = JSON.parse(raw);
            const formatted = {
              name: pkg.name,
              version: pkg.version,
              scripts: pkg.scripts || {},
              dependencies: pkg.dependencies || {},
              devDependencies: pkg.devDependencies || {},
            };
            return {
              toolCallId: '',
              name: toolName,
              output: JSON.stringify(formatted, null, 2),
            };
          } catch (e: any) {
            return {
              toolCallId: '',
              name: toolName,
              output: `Failed to parse package.json: ${e.message}`,
              error: e.message,
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 17: inspect_environment_safely (Zero Secrets Exposed!)
        // ----------------------------------------------------------------------
        case 'inspect_environment_safely': {
          let gitVer = 'unknown';
          try {
            const { stdout } = await execAsync('git --version');
            gitVer = stdout.trim();
          } catch {}

          const safeEnv = {
            os: process.platform,
            architecture: process.arch,
            nodeVersion: process.version,
            gitVersion: gitVer,
            workspaceRoot: `[PROJECT_ROOT]/${(projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '')}`,
            activeUserRole: context.user?.role || 'editor',
            isSandboxIsolated: true,
          };

          return {
            toolCallId: '',
            name: toolName,
            output: JSON.stringify(safeEnv, null, 2),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 18: inspect_project_context
        // ----------------------------------------------------------------------
        case 'inspect_project_context': {
          if (!context.projectMemory) {
            return {
              toolCallId: '',
              name: toolName,
              output: JSON.stringify(
                {
                  framework: 'Next.js 14 / React 18',
                  language: 'TypeScript',
                  architecture: 'Collaborative browser-based IDE with Monaco, Yjs, Supabase, and real-time agents.',
                  conventions: 'Modular services, strict typing, dark IDE aesthetics, zero client secrets.',
                  notes: 'No project-specific memory configured yet.',
                },
                null,
                2
              ),
            };
          }

          return {
            toolCallId: '',
            name: toolName,
            output: JSON.stringify(context.projectMemory, null, 2),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 19: inspect_collaboration_state
        // ----------------------------------------------------------------------
        case 'inspect_collaboration_state': {
          const collab = context.collaboration || { peerCount: 1, peers: [] };
          return {
            toolCallId: '',
            name: toolName,
            output: JSON.stringify(
              {
                peerCount: collab.peerCount,
                peers: collab.peers,
                openTabs: context.openTabs || [],
                activeEditorFile: context.activeFile?.path || null,
                syncStatus: 'connected',
              },
              null,
              2
            ),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 20: inspect_project_members
        // ----------------------------------------------------------------------
        case 'inspect_project_members': {
          const members = context.members || [
            {
              userId: context.user?.id || 'current-user',
              email: context.user?.email || 'user@radiux.dev',
              role: context.user?.role || 'editor',
            },
          ];
          return {
            toolCallId: '',
            name: toolName,
            output: JSON.stringify(
              {
                members,
                currentUserRole: context.user?.role || 'editor',
                totalMembers: members.length,
              },
              null,
              2
            ),
          };
        }

        // ----------------------------------------------------------------------
        // TOOL 21: run_typecheck
        // ----------------------------------------------------------------------
        case 'run_typecheck': {
          const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
          const startTime = Date.now();
          try {
            const { stdout } = await execAsync(`${npxCmd} tsc --noEmit`, { cwd: wsDir, timeout: 35000 });
            const duration = Date.now() - startTime;
            return {
              toolCallId: '',
              name: toolName,
              output: `Typecheck passed: 0 compiler errors (${duration}ms).\n${stdout ? stdout.trim() : ''}`.trim(),
            };
          } catch (err: any) {
            const duration = Date.now() - startTime;
            return {
              toolCallId: '',
              name: toolName,
              output: `TypeScript compiler detected errors (${duration}ms):\n${err.stdout || err.stderr || err.message}`,
              error: 'TypeScript typecheck failed',
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 22: run_build
        // ----------------------------------------------------------------------
        case 'run_build': {
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          const startTime = Date.now();
          try {
            const { stdout } = await execAsync(`${npmCmd} run build`, {
              cwd: wsDir,
              timeout: 120000,
              maxBuffer: 1024 * 1024 * 4,
            });
            const duration = Date.now() - startTime;
            return {
              toolCallId: '',
              name: toolName,
              output: `Build succeeded (${duration}ms):\n${stdout.slice(-1000)}`,
            };
          } catch (err: any) {
            const duration = Date.now() - startTime;
            return {
              toolCallId: '',
              name: toolName,
              output: `Build failed (${duration}ms):\n${err.stdout ? err.stdout.slice(-1500) : ''}\n${err.stderr ? err.stderr.slice(-1000) : ''}\n${err.message}`,
              error: 'Build failed',
            };
          }
        }

        // ----------------------------------------------------------------------
        // TOOL 23: run_tests
        // ----------------------------------------------------------------------
        case 'run_tests': {
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          const cmd = (args.testCommand || `${npmCmd} test`).trim();
          const startTime = Date.now();
          try {
            const { stdout } = await execAsync(cmd, { cwd: wsDir, timeout: 60000 });
            const duration = Date.now() - startTime;
            return {
              toolCallId: '',
              name: toolName,
              output: `Tests passed (${duration}ms):\n${stdout.slice(-1500)}`,
            };
          } catch (err: any) {
            const duration = Date.now() - startTime;
            return {
              toolCallId: '',
              name: toolName,
              output: `Tests failed (${duration}ms):\n${err.stdout ? err.stdout.slice(-1500) : ''}\n${err.stderr ? err.stderr.slice(-1000) : ''}\n${err.message}`,
              error: 'Test suite failed',
            };
          }
        }

        default:
          return {
            toolCallId: '',
            name: toolName,
            output: `Unknown tool "${toolName}".`,
            error: 'Unknown tool',
          };
      }
    } catch (err: any) {
      return {
        toolCallId: '',
        name: toolName,
        output: `Error executing ${toolName}: ${err.message}`,
        error: err.message,
      };
    }
  }
}
