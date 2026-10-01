import { describe, it, expect } from 'vitest';
import { PermissionEngine } from '@/lib/ai/agent/permissions';
import { AITool } from '@/lib/ai/types';

describe('AI Agent PermissionEngine & Safety Hardening', () => {
  describe('Terminal Command Safety Rules', () => {
    it('should classify safe read-only terminal commands as safe', () => {
      const safeCommands = [
        'ls',
        'ls -la',
        'dir',
        'pwd',
        'echo "hello world"',
        'cat package.json',
        'git status',
        'git diff',
        'git log -n 5',
        'git branch',
        'npm test',
        'npm run build',
        'npm run lint',
        'npx tsc --noEmit',
        'node -v',
      ];

      for (const cmd of safeCommands) {
        expect(PermissionEngine.isSafeCommand(cmd), `Expected "${cmd}" to be safe`).toBe(true);
      }
    });

    it('should classify destructive or dangerous commands as unsafe', () => {
      const dangerousCommands = [
        'rm -rf src/',
        'del /f /q C:\\',
        'rmdir /s /q .',
        'format c:',
        'git reset --hard HEAD~1',
        'git clean -fd',
        'npm install malicious-pkg',
        'npm uninstall critical-dep',
        'drop table users;',
        'delete from projects;',
        'echo "foo" > /dev/null',
      ];

      for (const cmd of dangerousCommands) {
        expect(PermissionEngine.isSafeCommand(cmd), `Expected "${cmd}" to be unsafe`).toBe(false);
      }
    });

    it('should reject empty or whitespace commands', () => {
      expect(PermissionEngine.isSafeCommand('')).toBe(false);
      expect(PermissionEngine.isSafeCommand('   ')).toBe(false);
    });
  });

  describe('Permission Modes Enforcement', () => {
    const mockTool = (name: string): AITool => ({
      name,
      description: `Test tool ${name}`,
      parameters: { type: 'object', properties: {} },
    });

    describe('READ_ONLY Mode', () => {
      it('should permit inspection and query tools', () => {
        const readTools = ['read_file', 'list_files', 'search_files', 'get_file_tree', 'git_status'];
        for (const name of readTools) {
          const res = PermissionEngine.check(mockTool(name), { path: 'test.ts' }, 'READ_ONLY');
          expect(res.allowed).toBe(true);
          expect(res.requiresConfirmation).toBe(false);
        }
      });

      it('should strictly prohibit write, edit, and mutating tools', () => {
        const mutatingTools = ['write_file', 'create_file', 'edit_file', 'delete_file'];
        for (const name of mutatingTools) {
          const res = PermissionEngine.check(mockTool(name), { path: 'test.ts' }, 'READ_ONLY');
          expect(res.allowed).toBe(false);
          expect(res.reason).toContain('READ_ONLY');
        }
      });
    });

    describe('ASSISTED Mode', () => {
      it('should allow read tools without confirmation', () => {
        const res = PermissionEngine.check(mockTool('read_file'), { path: 'src/index.ts' }, 'ASSISTED');
        expect(res.allowed).toBe(true);
        expect(res.requiresConfirmation).toBe(false);
      });

      it('should require explicit confirmation for write and edit tools', () => {
        const writeTools = ['write_file', 'create_file', 'edit_file', 'apply_editor_edit'];
        for (const name of writeTools) {
          const res = PermissionEngine.check(mockTool(name), { path: 'src/app.ts' }, 'ASSISTED');
          expect(res.allowed).toBe(true);
          expect(res.requiresConfirmation).toBe(true);
        }
      });

      it('should require confirmation for deleting files', () => {
        const res = PermissionEngine.check(mockTool('delete_file'), { path: 'src/old.ts' }, 'ASSISTED');
        expect(res.allowed).toBe(true);
        expect(res.requiresConfirmation).toBe(true);
        expect(res.reason).toContain('Deleting file');
      });
    });

    describe('AUTONOMOUS Mode', () => {
      it('should allow write tools directly without blocking confirmation', () => {
        const res = PermissionEngine.check(mockTool('write_file'), { path: 'src/utils.ts' }, 'AUTONOMOUS');
        expect(res.allowed).toBe(true);
        expect(res.requiresConfirmation).toBe(false);
      });

      it('should still require confirmation for file deletion', () => {
        const res = PermissionEngine.check(mockTool('delete_file'), { path: 'src/utils.ts' }, 'AUTONOMOUS');
        expect(res.allowed).toBe(true);
        expect(res.requiresConfirmation).toBe(true);
      });

      it('should execute safe terminal commands directly', () => {
        const res = PermissionEngine.check(mockTool('run_terminal'), { command: 'npm test' }, 'AUTONOMOUS');
        expect(res.allowed).toBe(true);
        expect(res.requiresConfirmation).toBe(false);
      });

      it('should require confirmation for unsafe terminal commands', () => {
        const res = PermissionEngine.check(mockTool('run_terminal'), { command: 'rm -rf node_modules' }, 'AUTONOMOUS');
        expect(res.allowed).toBe(true);
        expect(res.requiresConfirmation).toBe(true);
      });
    });
  });
});
