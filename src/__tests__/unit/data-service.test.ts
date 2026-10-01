import { describe, it, expect, beforeEach } from 'vitest';
import { DataService } from '@/lib/data-service';
import { StorageMock } from '@/lib/storage-mock';
import { UserProfile } from '@/lib/types';

describe('DataService & Storage Operations', () => {
  const testUser: UserProfile = {
    id: 'user-test-owner-123',
    email: 'developer@example.com',
    full_name: 'Lead Developer',
    username: 'leaddev',
  };

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    StorageMock.saveProfile(testUser);
  });

  describe('User Lookup', () => {
    it('should find user by username or ID', async () => {
      const user = await DataService.findUser('leaddev');
      expect(user).not.toBeNull();
      expect(user?.email).toBe('developer@example.com');
    });

    it('should return null for non-existent user identifier', async () => {
      const user = await DataService.findUser('nonexistent-ghost-user@example.com');
      expect(user).toBeNull();
    });

    it('should handle empty or whitespace identifiers', async () => {
      expect(await DataService.findUser('')).toBeNull();
      expect(await DataService.findUser('   ')).toBeNull();
    });
  });

  describe('Project CRUD Lifecycle', () => {
    it('should create a project with default files', async () => {
      const project = await DataService.createProject('Test Project', 'A sample test project', testUser);
      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');

      const files = await DataService.getFiles(project.id);
      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.name.includes('index.js'))).toBe(true);
    });

    it('should retrieve an existing project by ID', async () => {
      const created = await DataService.createProject('Retrieve Me', 'Desc', testUser);
      const retrieved = await DataService.getProject(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Retrieve Me');
    });

    it('should delete a project', async () => {
      const project = await DataService.createProject('To Delete', 'Desc', testUser);
      const deleted = await DataService.deleteProject(project.id);
      expect(deleted).toBe(true);
      const fetched = await DataService.getProject(project.id);
      expect(fetched).toBeNull();
    });
  });

  describe('File Management within Project', () => {
    it('should create, read, and update file contents', async () => {
      const project = await DataService.createProject('File Test', 'Desc', testUser);
      const newFile = await DataService.createFile(
        project.id,
        null,
        'math.ts',
        false,
        'export const add = (a: number, b: number) => a + b;'
      );
      expect(newFile.name).toBe('math.ts');

      const files = await DataService.getFiles(project.id);
      const match = files.find(f => f.name === 'math.ts');
      expect(match).toBeDefined();
      expect(match?.content).toContain('export const add');

      // Update content
      await DataService.updateFileContent(match!.id, 'export const multiply = (a: number, b: number) => a * b;');
      const updatedFiles = await DataService.getFiles(project.id);
      const updatedMatch = updatedFiles.find(f => f.id === match!.id);
      expect(updatedMatch?.content).toContain('multiply');
    });

    it('should delete a file from project', async () => {
      const project = await DataService.createProject('Delete File Test', 'Desc', testUser);
      const file = await DataService.createFile(project.id, null, 'temp.txt', false, 'temporary content');
      let files = await DataService.getFiles(project.id);
      expect(files.some(f => f.id === file.id)).toBe(true);

      await DataService.deleteFile(file.id);
      files = await DataService.getFiles(project.id);
      expect(files.some(f => f.id === file.id)).toBe(false);
    });
  });

  describe('ZIP Export and Packaging', () => {
    it('should export project files into a valid JSZip archive', async () => {
      const project = await DataService.createProject('Zip Test', 'Desc', testUser);
      await DataService.createFile(project.id, null, 'readme.md', false, '# Zip Test');
      // Verify exportProjectAsZip completes without error
      await expect(DataService.exportProjectAsZip(project)).resolves.not.toThrow();
    });
  });
});
