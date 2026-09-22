# Radiux Security Architecture & Hardening Guide

## 1. Executive Summary & Scope

Radiux is a modern, collaborative cloud IDE built on Next.js 14, React, Monaco Editor, Yjs, Supabase, and a dedicated Node.js WebSocket/PTY execution daemon.

> **CRITICAL ARCHITECTURAL STATEMENT ON CONTAINER SANDBOXING**
> **Cloud workspace infrastructure, Docker-in-Docker, Kubernetes, and container sandboxing are explicitly OUT OF SCOPE for this pass.**
> Radiux runs within the current architecture:
> **Vercel Frontend + Render Node.js WebSocket/PTY Backend + Supabase Postgres/Auth + Host Filesystem Workspaces.**
> Do not assume or claim that terminal processes or commands run within isolated Docker containers. Instead, security is enforced through strict host-level defense-in-depth, RBAC guards, path sandboxing, and environment variable sanitization.

---

## 2. Authentication & Authorization

### 2.1 Authentication
- Supabase Auth manages user identity (Email/Password, Google OAuth, GitHub OAuth, Magic Links).
- JSON Web Tokens (JWT) signed by Supabase are verified on the Next.js frontend, API routes, and the backend WebSocket daemon via `verifyToken(token)`.

### 2.2 Role-Based Access Control (RBAC)
Every project workspace enforces a strict 3-tier role hierarchy:

| Role | Permissions | Server-Side Enforcement |
| :--- | :--- | :--- |
| **Owner** | Full workspace management, member invitations/removals, role modifications, project deletion, file edits, terminal execution, Git writes, and Zodiac AI tools. | Enforced in Supabase RLS, `/api/workspace/exec`, `/terminal` WS, and `/api/git/*`. |
| **Editor** | File read/write, real-time collaboration, chat, voice, terminal execution, Git commits/branching, Zodiac AI write tools (with approval). Cannot manage members or delete project. | Authorized for collaborative editing; blocked from member/ownership mutations. |
| **Visitor** | **Strictly read-only access.** Can view files, Monaco editor, diagnostics, and project chat. **FORBIDDEN from modifying files, executing terminal commands, creating Git commits/branches, or using AI write/terminal tools.** | **Server-side rejection**: 403 Forbidden returned on `/api/workspace/exec`, `/terminal` WS handshake rejected with 403, and `/api/git/*` write actions rejected with 403. Monaco editor is set to `readOnly`. |

Defense-in-depth ensures client-side tampering (e.g. modifying DevTools or crafting raw WebSocket/HTTP requests) cannot bypass Visitor restrictions.

---

## 3. Filesystem & Workspace Path Security

All project files on the backend filesystem are stored under `.workspaces/{projectId}/`.
To prevent directory traversal attacks:

1. **Project ID Sanitization**:
   `WorkspaceManager.sanitizeProjectId(projectId)` strictly filters IDs to alphanumeric characters and hyphens:
   ```javascript
   const clean = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
   ```
2. **Canonical Path Confinement**:
   Every path operation resolves the canonical target path and verifies containment within the project workspace directory:
   ```javascript
   const dir = path.resolve(WORKSPACES_ROOT, cleanId);
   if (!dir.startsWith(WORKSPACES_ROOT)) {
     throw new Error(`Security violation: Invalid project directory traversal attempted`);
   }
   ```
3. **Traversal Strip**:
   Leading `../` and `..\` sequences in relative file paths are automatically stripped before resolving:
   ```javascript
   const safeRelative = (relativePath || '').replace(/^(\.\.[\/\\])+/, '');
   const fullPath = path.resolve(wsDir, safeRelative);
   if (!fullPath.startsWith(wsDir)) {
     console.warn(`[WorkspaceManager] Blocked directory traversal attempt: ${relativePath}`);
     return;
   }
   ```

---

## 4. Environment Sanitization & Secret Isolation

The Radiux backend daemon executes commands using `child_process` and `node-pty`. To protect production database credentials and API secrets from being inspected or exfiltrated via the terminal or AI tools:

1. **Filtered Environment (`getSanitizedEnv`)**:
   All sensitive environment variables matching the following pattern are stripped from the child process environment:
   ```javascript
   const isSensitive = /SUPABASE|GROQ|SECRET|KEY|TOKEN|PASSWORD|DATABASE|CREDENTIAL|AUTH|RENDER|ALLOWED_ORIGIN|COOKIE|PRIVATE/i.test(k);
   ```
2. **No Environment Leakage**:
   The execution daemon does **not** spread `process.env` back over `safeEnv`. Child terminal sessions and execution commands run exclusively with the sanitized environment dictionary.
3. **Zero Frontend Exposure**:
   - `GROQ_API_KEY` is strictly server-side.
   - `SUPABASE_SERVICE_ROLE_KEY` is strictly server-side.
   - Database connection strings are never sent to the client or logged.

---

## 5. WebSocket & Real-Time Communication Security

1. **Origin Verification (`ALLOWED_ORIGIN`)**:
   In production, the WebSocket server rejects upgrade requests from origins that do not match the configured whitelist or official Vercel application domains.
2. **Token Verification**:
   When configured with `SUPABASE_SERVICE_ROLE_KEY`, WebSocket connection handshakes verify the Supabase JWT before granting terminal or communication access.
3. **Visitor Connection Rejection**:
   WebSocket `/terminal` connection upgrades reject connections with `role=visitor` immediately during HTTP upgrade with `403 Forbidden`.

---

## 6. Zodiac 1.0 Agentic AI Security

1. **Model Output is Untrusted**:
   Zodiac 1.0 tool arguments are validated on the server before execution.
2. **Deterministic RBAC Gatekeeper**:
   In `ToolExecutor`, every tool call checks the caller's role. If a visitor attempts to invoke `write_file`, `edit_file`, `delete_file`, or `run_terminal`, the tool execution halts and returns a permission error.
3. **Human-in-the-Loop Approval**:
   File modifications and destructive commands require explicit user approval via diff review (`[Accept]` / `[Reject]`) before Yjs or filesystem mutation.

---

## 7. Known Limitations

- **Process Isolation**: Terminal processes run under the host system user running the backend Node.js process. As cloud containerization is not implemented, host-level network or resource limits are not isolated by virtual kernel namespaces.
- **Resource Exhaustion**: Malicious infinite loops or heavy CPU tasks in user code could consume host CPU cycles. A 30-second to 60-second execution timeout is enforced on non-interactive command executions.
