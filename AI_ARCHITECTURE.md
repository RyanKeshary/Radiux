# Radiux AI Coding Agent & Workspace Intelligence Architecture

## Overview
Radiux features an autonomous, multi-step AI Coding Agent and Workspace Intelligence layer inspired by the interaction workflows of advanced coding assistants (such as Cursor and Antigravity). The agent operates directly within the browser IDE, progressive workspace context, Monaco editor, Yjs collaboration engine, and backend PTY execution environment.

---

## Architectural Principles

1. **Provider-Agnostic Interface**:
   - Built on an extensible `AIProvider` contract (`src/lib/ai/types.ts`).
   - Official Groq SDK provider (`groq-sdk`) implemented in `src/lib/ai/groq-provider.ts`.
   - Default model: `llama-3.3-70b-versatile` with configurable fallback (`AI_MODEL` environment variable).
   - Zero exposure of `GROQ_API_KEY` to client-side code; all LLM calls originate from server routes (`/api/ai/agent`, `/api/ai/inline`).

2. **Progressive Workspace Exploration**:
   - Rather than sending the whole repository in a single context window, Radiux provides an immediate high-level overview (open tabs, active file, selection, git branch, diagnostics) and equips the agent with 14 specialized inspection and modification tools.
   - The agent progressively reads, searches, and inspects files as needed during its multi-step loop.

3. **Collaborative File Modification via Diffs**:
   - Changes are proposed as structured hunks (`DiffProposal`).
   - Users review side-by-side or inline Monaco diffs with one-click **Accept** or **Reject**.
   - Accepted diffs apply directly to the Monaco editor model and propagate automatically across active collaborative peers via Yjs CRDTs.

4. **3-Tier Permission Engine**:
   - **Read-Only**: The agent can inspect workspace files, run searches, view git status, and examine diagnostics, but cannot modify files or execute terminal commands.
   - **Assisted (Default)**: Safe inspection commands and non-destructive terminal reads (e.g. `npm test`, `git status`, `npx tsc`) execute automatically. File writes, edits, deletions, and commands require explicit user approval in the UI.
   - **Autonomous**: File writes and safe commands execute without interrupting the user. File deletions and dangerous terminal commands (e.g. `rm -rf`, `git reset --hard`, `drop table`) unconditionally require human confirmation.

---

## Core Components

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Monaco Editor / UI                            │
│  - Inline Ctrl+K Prompt (InlineAIPrompt.tsx)                           │
│  - Right AI Panel & Chat (AIAgentPanel.tsx)                            │
│  - Side-by-Side Monaco Diff Viewer (DiffViewerModal.tsx)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SSE Stream
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Server API                              │
│  - /api/ai/agent (SSE streaming agent loop)                            │
│  - /api/ai/inline (Inline code transformations)                        │
│  - /api/ai/conversations (Conversation history & persistence)         │
│  - /api/ai/project-context (Workspace index & project notes)           │
│  - /api/admin/* (RBAC-gated system metrics, user roles, usage)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
       ┌───────────────────────────┐ ┌───────────────────────────┐
       │     Agent Engine & Loop   │ │   Backend Workspace Server│
       │ - Tool Registry (14 tools)│ │ - PTY Terminal & Command  │
       │ - Sandbox & Path Security │ │   Execution (/api/workspace/│
       │ - Permission Classifier   │ │   exec)                   │
       │ - Groq Provider (LLM API) │ │ - WebSocket Sync & Health │
       └───────────────────────────┘ └───────────────────────────┘
```

---

## The 14 Core AI Agent Tools

| Tool Name | Type | Description |
|-----------|------|-------------|
| `list_files` | Read | Lists files and subdirectories with optional path and recursive flags. |
| `read_file` | Read | Reads line ranges from workspace files with length bounds. |
| `search_files` | Read | Ripgrep-style literal/regex search across workspace files. |
| `get_file_tree` | Read | Returns hierarchical folder structure up to a max depth. |
| `get_current_file`| Read | Returns the path, language, and content of active Monaco editor file. |
| `get_selection` | Read | Returns the current user selection range and selected code text. |
| `write_file` | Write | Creates or overwrites a file; returns diff proposal in Assisted mode. |
| `edit_file` | Write | Performs surgical line replacements; returns diff proposal. |
| `delete_file` | Destructive | Deletes a file. Unconditionally requires user confirmation. |
| `run_terminal` | Exec | Executes safe commands or requests confirmation for destructive actions. |
| `git_status` | Read | Returns branch, staged, unstaged, and untracked file status. |
| `git_diff` | Read | Returns unified diffs of uncommitted changes. |
| `git_log` | Read | Returns recent commit history. |
| `diagnostics` | Read | Returns compiler errors, linter warnings, and Monaco markers. |

---

## Security & Sandboxing

1. **Path Sandboxing**:
   - All file operations pass through `sanitizePath()`.
   - Paths starting with `/`, containing `..`, or resolving outside the project root are rejected immediately.
2. **Command Whitelisting & Blacklisting**:
   - Safe commands (e.g. `npm test`, `git status`, `dir`, `ls`, `npx tsc`) are distinguished using regular expressions.
   - Destructive patterns (e.g. `rm -rf`, `git reset --hard`, `del /f`, `format`, `truncate`) are strictly guarded across all permission modes.
3. **Environment Isolation**:
   - AI API keys and database service role credentials exist solely within server runtime memory (`process.env`).
   - Client requests are authenticated via Supabase JWTs.

---

## Admin Panel & RBAC

Located at `/admin`:
- Guarded by server-side role check (`profiles.role === 'admin'`). Non-admin users receive a 403 Forbidden response.
- **Overview**: Real-time stats on total users, active workspaces, AI token usage, and system load.
- **Users**: Search, filter, inspect profiles, and toggle Admin/Member roles.
- **AI Usage**: Token consumption breakdowns, request counts, and cost analytics.
- **AI Settings**: Default model selector (`llama-3.3-70b-versatile`), max tokens, temperature, and agent step limits.
- **System**: Backend server health, PTY process metrics, and environment checks.
- **Audit Logs**: Immutable log of administrative actions and AI agent operations.

---

## Database Schema (Migration v13)

- `ai_conversations`: Stores user agent sessions, project association, and metadata.
- `ai_messages`: Persists user prompts, assistant thoughts, tool calls, and execution outputs.
- `ai_usage`: Tracks token usage, model identifiers, and durations per user/project.
- `ai_project_context`: Stores custom instructions, project tech stack notes, and indexing status.
- `ai_settings`: Global system configuration for models, step limits, and safety thresholds.
- `admin_audit_logs`: Audit trail for compliance, role adjustments, and security events.
- `profiles.role`: Added `role` column (`'admin' | 'member' | 'guest'`) with RLS enforcement.
