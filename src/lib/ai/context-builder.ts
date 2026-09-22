import { WorkspaceAIContext, ActiveFileContext } from './types';
import { AIConfig } from './config';

/**
 * Workspace Context Builder
 * Selectively collates relevant editor and project state into a compact context
 * without overwhelming the model token window.
 */
export class ContextBuilder {
  static build(input: Partial<WorkspaceAIContext>): WorkspaceAIContext {
    const user = input.user || {
      id: 'guest',
      name: 'Developer',
    };

    const project = input.project || {
      id: 'default',
      name: 'Workspace',
    };

    let activeFile: ActiveFileContext | undefined = undefined;
    if (input.activeFile) {
      activeFile = {
        id: input.activeFile.id,
        path: input.activeFile.path,
        language: input.activeFile.language,
        selection: input.activeFile.selection,
      };

      // Cap content size if provided
      if (input.activeFile.content) {
        if (input.activeFile.content.length > 20000) {
          activeFile.content = input.activeFile.content.slice(0, 20000) + '\n...[truncated remainder of file]';
        } else {
          activeFile.content = input.activeFile.content;
        }
      }
    }

    return {
      user,
      project,
      activeFile,
      openTabs: input.openTabs?.slice(0, 15) || [],
      git: input.git,
      diagnostics: input.diagnostics ? AIConfig.sanitizeText(input.diagnostics.slice(0, 4000)) : undefined,
      projectMemory: input.projectMemory,
    };
  }
}
