# RADIUX â€” Comprehensive Project Intelligence & Current-State Technical Audit

**Document Version:** 1.0.0  
**Audit Date:** September 2026  
**Auditor:** Antigravity Autonomous Engineering Agent  
**Branch:** `main` (Git Commit: `63e1600`)  
**Workspace Root:** `c:\Users\krish\Downloads\shit dump temp\web ide`  
**Application Title:** Radiux â€” Real-Time Collaborative IDE  
**Primary Repository:** [RyanKeshary/Radiux](https://github.com/RyanKeshary/Radiux.git)  

---

## 1. Executive Summary

**Radiux** (formerly referenced during development as *CodeCollab* / *web-ide*) is a browser-based, collaborative integrated development environment (IDE) built on Next.js 14, React 18, TypeScript 5, Monaco Editor, and a dedicated Node.js WebSocket/PTY companion server.

### Key Audit Findings:
1. **Build & Type Health:** The repository compiles with **0 TypeScript errors** (`npx tsc --noEmit`) and produces an optimized production build (`next build`) passing all lint and route generation checks.
2. **Operational Runtimes:** The system operates in dual mode:
   - **Local Environment:** Next.js frontend running on `http://localhost:3000`, Node WebSocket/PTY server running on `0.0.0.0:1234`.
   - **Cloud Environment:** Vercel frontend connected to Render web service (`codecollab-backend-isjt.onrender.com`) and cloud Supabase PostgreSQL (`your-project.supabase.co`).
3. **Core Architectural Pattern:** The application implements a **hybrid dual-persistence architecture**. Primary operations target Supabase PostgreSQL tables and Auth with strict Row Level Security (RLS). When Supabase is unreachable or unconfigured, the system automatically falls back to the Node.js backend workspace disk (`.workspaces/data/` JSON stores) and a client-side localStorage cache (`StorageMock`).
4. **Current Maturity Stage:** **Public Beta / Pre-Production**. All core workflows (Auth, Monaco editing, Yjs CRDT real-time multi-cursor sync, host pseudo-terminals with multi-session tabs, Git staging/committing/branching, WebRTC voice, in-workspace dev server previewing, and public profiles) are functional. Key technical debt items (unifying the dual persistence layer, sandboxing terminal execution, and adding missing route handlers such as password reset) remain before enterprise production scale.

---

## 2. What Radiux Is

### Definition
Radiux is a cloud and local developer workspace platform that runs a complete VS Code-style development experience directly inside web browsers. It eliminates local environment configuration by pairing Monaco Editor with a real, OS-level pseudo-terminal (PTY) backend, allowing developers to write, build, test, collaborate on, and preview code in real time.

### Problem Solved
- **Zero-Setup Collaborative Coding:** Eliminates "works on my machine" friction and screen-sharing setups. Multiple engineers can concurrently edit the same files with live shared cursors, text selections, and voice communication.
- **Remote Host Runtime:** Unlike browser editors that merely evaluate JavaScript in a web worker or iframe, Radiux runs real host processes (Node.js, Python, npm, Git, Bash, PowerShell) managed by a backend PTY process daemon.
- **Developer Identity & Social Discovery:** Combines IDE functionality with developer profiles, contribution heatmaps, project pinning, peer search, and direct coding partner requests.

### Current Implementation Profile
| Layer | Capabilities |
| :--- | :--- |
| **IDE Layer** | Multi-tab Monaco editor, 8 themes, custom keybindings, syntax highlighting, minimap, breadcrumbs, search, file explorer. |
| **Runtime Layer** | Real OS PTY sessions (`node-pty`), shell switching (PowerShell, CMD, Git Bash, WSL, Bash, Zsh), port detection, reverse proxy preview. |
| **Collaboration Layer** | Yjs CRDT document synchronization, awareness cursors, project chat with media uploads, WebRTC mesh voice rooms, inline comments, pull requests. |
| **Identity Layer** | Supabase Auth (Email, Google, GitHub), public developer handles (`/profile/[username]`), 52-week contribution heatmap, pinned projects, partner state machine. |
| **Deployment Layer** | In-IDE deploy modal with Vercel and Render API integrations, preview pane with live dev server reverse proxy (`/proxy/:port/*`). |

---

## 3. Current Product Capabilities

### What a User Can Genuinely Do Right Now:
1. **Authenticate Seamlessly:** Register, log in, or reset sessions using Email/Password, Google OAuth, or GitHub OAuth.
2. **Create & Manage Projects:** Create projects in Supabase or local storage, import ZIP archives, and export complete workspace bundles.
3. **Edit Code Collaboratively:** Open multiple tabs, edit files in Monaco with real-time cursor tracking and shared edits via Yjs.
4. **Execute Real Terminal Commands:** Open multiple pseudo-terminals on host operating systems (Windows PowerShell, CMD, Git Bash, WSL, Linux Bash), run `node`, `python`, `npm`, `git`, and custom scripts.
5. **Preview Web Applications:** Automatically detect running dev servers (e.g. port 3000, 5000, 8080) and preview web apps inside an integrated iframe via `/proxy/:port/*` or static file server `/preview/:projectId/*`.
6. **Perform Full Git Operations:** View repository status, stage/unstage files, commit changes with custom author info, inspect diffs, create/switch/delete branches, configure remotes, and pull/push via GitHub tokens.
7. **Communicate in Real-Time:** Send text messages and upload images/media to project chat, join WebRTC voice calls with mute controls, and leave inline code review comments.
8. **Network with Developers:** Discover peers, view public developer profiles with privacy filters, send/accept/decline coding partner requests, and receive non-intrusive notification badges.

---

## 4. Current Architecture

```text
                                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                    â”‚                     BROWSER CLIENT                      â”‚
                                    â”‚                                                         â”‚
                                    â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
                                    â”‚  â”‚  Next.js App   â”‚  â”‚ Monaco Editor  â”‚  â”‚ XTerm.js  â”‚  â”‚
                                    â”‚  â”‚  (App Router)  â”‚  â”‚  + Yjs Binding â”‚  â”‚  Emulator â”‚  â”‚
                                    â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜  â”‚
                                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                               â”‚                   â”‚                 â”‚
                                    HTTPS / REST API          WSS (Yjs)         WSS (/terminal)
                                               â”‚                   â”‚                 â”‚
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”
                         â”‚                                                                    â”‚
                         â–¼                                                                    â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                               â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚        VERCEL / NEXT.JS          â”‚                               â”‚          NODE.JS BACKEND         â”‚
        â”‚   (Frontend Hosting & SSR)       â”‚                               â”‚       (server/websocket.mjs)     â”‚
        â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤                               â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
        â”‚ - SSR & Static Pages             â”‚                               â”‚ - Yjs WebSocket Sync Server      â”‚
        â”‚ - Auth Middleware (Session Guard)â”‚                               â”‚ - Node-PTY Terminal Daemon       â”‚
        â”‚ - OAuth Callback (/auth/callback)â”‚                               â”‚ - WorkspaceManager (Disk Sync)   â”‚
        â”‚ - Client Bundles & Styling       â”‚                               â”‚ - GitManager (Child Process Git) â”‚
        â”‚ - Image Optimization             â”‚                               â”‚ - CommRooms (Voice Signaling)    â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                               â”‚ - Dev Server Reverse Proxy       â”‚
                         â”‚                                                 â”‚ - Disk Storage (.workspaces/)    â”‚
                         â”‚                                                 â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                         â”‚                                                                  â”‚
                         â”‚                      HTTPS / REST / PostgREST                    â”‚
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                           â”‚
                                                           â–¼
                                           â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                           â”‚       SUPABASE PLATFORM        â”‚
                                           â”‚ (your-project-ref.supabase)â”‚
                                           â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
                                           â”‚ - Supabase Auth (GoTrue)       â”‚
                                           â”‚   â€¢ Google & GitHub OAuth      â”‚
                                           â”‚   â€¢ Email/Password             â”‚
                                           â”‚ - PostgreSQL Database (v15)    â”‚
                                           â”‚   â€¢ profiles, projects         â”‚
                                           â”‚   â€¢ project_members, files     â”‚
                                           â”‚   â€¢ messages, activities       â”‚
                                           â”‚   â€¢ coding_partners, notifs    â”‚
                                           â”‚   â€¢ Row Level Security (RLS)   â”‚
                                           â”‚ - Supabase Storage             â”‚
                                           â”‚   â€¢ chat-media (bucket)        â”‚
                                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 5. Technology Stack

### Frontend
- **Framework:** Next.js 14.2.15 (App Router, React Server Components + Client Components)
- **Runtime:** React 18.3.1
- **Language:** TypeScript 5.0
- **Editor:** `@monaco-editor/react` (v4.6.0) & `monaco-editor` (v0.51.0)
- **Terminal Emulator:** `@xterm/xterm` (v6.0.0) with `@xterm/addon-fit` (v0.11.0)
- **Collaboration & CRDT:** `yjs` (v13.6.19), `y-monaco` (v0.1.6), `y-websocket` (v2.0.4), `y-protocols` (v1.0.6)
- **Styling:** Tailwind CSS 3.4.1, PostCSS 8, Autoprefixer 10, Vanilla CSS Tokens
- **Icons:** `lucide-react` (v0.447.0)
- **Archiving & Export:** `jszip` (v3.10.2)
- **Audio & Sound:** HTML5 Web Audio API synthesizers (`src/lib/sound.ts`)

### Backend
- **Runtime:** Node.js (ES Modules, `.mjs`)
- **Server:** Native Node.js `http` module (`http.createServer`)
- **WebSocket Technology:** `ws` (v8.18.0)
- **Pseudo-Terminal (PTY):** `node-pty` (v1.1.0)
- **Source Control Subsystem:** Native OS `git` binary via `child_process.execFile`
- **Concurrency Tooling:** `concurrently` (v9.0.1)

### Database & Cloud
- **Database Provider:** Supabase (Cloud PostgreSQL 15)
- **Client SDKs:** `@supabase/supabase-js` (v2.45.4), `@supabase/ssr` (v0.5.1)
- **Storage:** Supabase Storage (Bucket: `chat-media`, 50MB max upload)
- **Authentication:** Supabase Auth (OAuth 2.0 with PKCE code exchange)

---

## 6. Repository Structure

```text
web ide/
â”œâ”€â”€ .env.example                     # Reference environment configuration
â”œâ”€â”€ .env.local                       # Active local secrets & provider tokens (gitignored)
â”œâ”€â”€ .env.production                  # Production URLs for Vercel builds
â”œâ”€â”€ .gitignore                       # Git exclusion rules
â”œâ”€â”€ DEPLOYMENT.md                    # Multi-provider deployment documentation
â”œâ”€â”€ next.config.js                   # Next.js configuration (images, SWC, optimization)
â”œâ”€â”€ package.json                     # Project manifest and scripts
â”œâ”€â”€ postcss.config.js                # PostCSS plugins
â”œâ”€â”€ tailwind.config.js               # Tailwind design tokens and animations
â”œâ”€â”€ tsconfig.json                    # TypeScript compiler options
â”œâ”€â”€ render.yaml                      # Render Blueprint specification for backend web service
â”œâ”€â”€ RADIUX_PROJECT_AUDIT.md          # Historical engineering audit report
â”œâ”€â”€ RADIUX_CURRENT_STATE.md          # [THIS FILE] Authoritative project intelligence report
â”‚
â”œâ”€â”€ public/                          # Static public assets
â”‚   â”œâ”€â”€ favicon.ico
â”‚   â”œâ”€â”€ icon.png
â”‚   â””â”€â”€ logo.png
â”‚
â”œâ”€â”€ scripts/                         # Maintenance and verification scripts
â”‚   â”œâ”€â”€ apply-schema.mjs             # Remote schema migration utility
â”‚   â””â”€â”€ test-sync.mjs                # WebSocket & file sync diagnostic script
â”‚
â”œâ”€â”€ server/                          # Dedicated Node.js Backend Companion Server
â”‚   â”œâ”€â”€ git-manager.mjs              # Server-side Git operations (status, commit, branch, diff, push)
â”‚   â”œâ”€â”€ websocket.mjs                # HTTP REST API + 3-way WebSocket server (Yjs, PTY, Comm)
â”‚   â””â”€â”€ workspace-manager.mjs        # PTY process manager, shell discovery, disk file sync
â”‚
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ middleware.ts                # Next.js edge auth session guard & route matcher
â”‚   â”‚
â”‚   â”œâ”€â”€ app/                         # Next.js App Router
â”‚   â”‚   â”œâ”€â”€ globals.css              # Global design system variables and theme tokens
â”‚   â”‚   â”œâ”€â”€ layout.tsx               # Root application shell with AuthProvider
â”‚   â”‚   â”œâ”€â”€ page.tsx                 # Dashboard & Landing page (project listing, quick actions)
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â””â”€â”€ callback/
â”‚   â”‚   â”‚       â””â”€â”€ route.ts         # OAuth PKCE exchange & profile synchronization route
â”‚   â”‚   â”œâ”€â”€ login/
â”‚   â”‚   â”‚   â””â”€â”€ page.tsx             # Dedicated sign-in and account registration page
â”‚   â”‚   â”œâ”€â”€ profile/
â”‚   â”‚   â”‚   â”œâ”€â”€ page.tsx             # Authenticated user redirect to self profile
â”‚   â”‚   â”‚   â””â”€â”€ [username]/
â”‚   â”‚   â”‚       â””â”€â”€ page.tsx         # Public developer profile page
â”‚   â”‚   â”œâ”€â”€ project/
â”‚   â”‚   â”‚   â””â”€â”€ [id]/
â”‚   â”‚   â”‚       â”œâ”€â”€ page.tsx         # Primary IDE workspace entry point
â”‚   â”‚   â”‚       â””â”€â”€ public/
â”‚   â”‚   â”‚           â””â”€â”€ page.tsx     # Read-only public shared project view
â”‚   â”‚   â””â”€â”€ settings/
â”‚   â”‚       â””â”€â”€ page.tsx             # Global application settings page
â”‚   â”‚
â”‚   â”œâ”€â”€ components/                  # UI Presentation & Interaction Layer
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â”œâ”€â”€ AuthModal.tsx        # In-context modal for logging in or creating account
â”‚   â”‚   â”‚   â””â”€â”€ UserMenu.tsx         # Top-right account dropdown with theme selector & shortcuts
â”‚   â”‚   â”œâ”€â”€ dashboard/
â”‚   â”‚   â”‚   â”œâ”€â”€ CreateProjectModal.tsx # Project creation modal
â”‚   â”‚   â”‚   â”œâ”€â”€ ImportProjectModal.tsx # GitHub repository import modal
â”‚   â”‚   â”‚   â””â”€â”€ ImportWorkspaceModal.tsx # ZIP workspace backup restoration modal
â”‚   â”‚   â”œâ”€â”€ profile/
â”‚   â”‚   â”‚   â”œâ”€â”€ ContributionGraph.tsx  # 52-week GitHub-style activity contribution calendar
â”‚   â”‚   â”‚   â”œâ”€â”€ DeveloperDiscoveryModal.tsx # Peer developer discovery and search modal
â”‚   â”‚   â”‚   â”œâ”€â”€ DeveloperProfileView.tsx # Comprehensive developer profile showcase
â”‚   â”‚   â”‚   â”œâ”€â”€ DirectMessageModal.tsx # Private developer direct message dialogue
â”‚   â”‚   â”‚   â”œâ”€â”€ PinnedProjectsSection.tsx # Showcase of up to 4 pinned projects
â”‚   â”‚   â”‚   â”œâ”€â”€ ProfileEditorModal.tsx # Detailed profile editing modal with tabbed controls
â”‚   â”‚   â”‚   â”œâ”€â”€ ProfilePreviewCard.tsx # Hover/click compact popover preview card
â”‚   â”‚   â”‚   â””â”€â”€ ProfileReadme.tsx      # Markdown renderer for developer personal README
â”‚   â”‚   â””â”€â”€ workspace/
â”‚   â”‚       â”œâ”€â”€ ActivityBar.tsx      # Leftmost navigation bar (Files, Git, Feed, Ext, etc.)
â”‚   â”‚       â”œâ”€â”€ ActivityFeed.tsx     # Workspace audit timeline and event stream
â”‚   â”‚       â”œâ”€â”€ BottomDock.tsx       # Tabbed bottom panel (Terminal, Output, Problems, Voice, Chat)
â”‚   â”‚       â”œâ”€â”€ Breadcrumbs.tsx      # Path breadcrumbs bar above the code editor
â”‚   â”‚       â”œâ”€â”€ ChatPanel.tsx        # Project team chat with rich media upload and reactions
â”‚   â”‚       â”œâ”€â”€ CollaboratorsPanel.tsx # Active peer list with follow-mode and kick controls
â”‚   â”‚       â”œâ”€â”€ CommandPalette.tsx   # Ctrl+Shift+P quick command execution modal
â”‚   â”‚       â”œâ”€â”€ ContextMenu.tsx      # Custom context menu for file tree items
â”‚   â”‚       â”œâ”€â”€ DiffViewerModal.tsx  # Side-by-side Monaco diff inspection modal
â”‚   â”‚       â”œâ”€â”€ EditorSettingsModal.tsx # Comprehensive Monaco and IDE configuration modal
â”‚   â”‚       â”œâ”€â”€ ExtensionsPanel.tsx  # Extension marketplace mockup & discovery panel
â”‚   â”‚       â”œâ”€â”€ FileIcon.tsx         # File-extension-aware icon renderer
â”‚   â”‚       â”œâ”€â”€ FileTree.tsx         # Nested interactive folder & file explorer
â”‚   â”‚       â”œâ”€â”€ GitHubModal.tsx      # GitHub repository linking and sync modal
â”‚   â”‚       â”œâ”€â”€ GitPanel.tsx         # VS Code-style Git source control management UI
â”‚   â”‚       â”œâ”€â”€ GlobalSearchModal.tsx # Cross-project file content search modal
â”‚   â”‚       â”œâ”€â”€ InlineCommentsOverlay.tsx # Line-level code review comment pins
â”‚   â”‚       â”œâ”€â”€ IntegrationsModal.tsx # Third-party service integration management
â”‚   â”‚       â”œâ”€â”€ InviteMemberModal.tsx # Collaborator invitation dialogue
â”‚   â”‚       â”œâ”€â”€ KeyboardShortcutsModal.tsx # Complete keyboard shortcut cheat sheet
â”‚   â”‚       â”œâ”€â”€ MediaPreviewModal.tsx # Fullscreen modal for images, audio, and videos
â”‚   â”‚       â”œâ”€â”€ MediaViewer.tsx      # In-tab media file viewer (PNG, JPG, MP4, MP3)
â”‚   â”‚       â”œâ”€â”€ MonacoEditorWrapper.tsx # Monaco editor mounted with Yjs binding & remote cursor tags
â”‚   â”‚       â”œâ”€â”€ NotificationCenterPanel.tsx # Slide-in drawer for managing alerts & requests
â”‚   â”‚       â”œâ”€â”€ NotificationToast.tsx # Toast notification models, container, & corner alerts
â”‚   â”‚       â”œâ”€â”€ OpenTabs.tsx         # Draggable/closeable editor tab strip
â”‚   â”‚       â”œâ”€â”€ OutputPanel.tsx      # System build and execution logs console
â”‚   â”‚       â”œâ”€â”€ PreviewPanel.tsx     # In-browser iframe live web preview & reverse proxy
â”‚   â”‚       â”œâ”€â”€ ProblemsPanel.tsx    # Syntax warnings and linter diagnostics dock
â”‚   â”‚       â”œâ”€â”€ ProjectPresence.tsx  # Top navigation collaborator avatars and shared cursors
â”‚   â”‚       â”œâ”€â”€ ProjectSwitcherModal.tsx # Quick modal to jump between recent workspaces
â”‚   â”‚       â”œâ”€â”€ PublicProfileModal.tsx # Modal wrapper for viewing peer public profiles
â”‚   â”‚       â”œâ”€â”€ QuickOpenModal.tsx   # Ctrl+P quick file search and open modal
â”‚   â”‚       â”œâ”€â”€ ReviewRequestsModal.tsx # Pull Request & Code Review management modal
â”‚   â”‚       â”œâ”€â”€ TerminalPanel.tsx    # XTerm.js multi-session pseudo-terminal container
â”‚   â”‚       â”œâ”€â”€ UserProfileModal.tsx # Comprehensive personal profile modal
â”‚   â”‚       â”œâ”€â”€ VoicePanel.tsx       # WebRTC voice room participant dock
â”‚   â”‚       â””â”€â”€ Workspace.tsx        # Master IDE workspace controller component (100KB)
â”‚   â”‚
â”‚   â”œâ”€â”€ context/
â”‚   â”‚   â””â”€â”€ AuthContext.tsx          # Global authentication state, session listener, profile sync
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”œâ”€â”€ useClickOutside.ts       # DOM outside click detection hook
â”‚   â”‚   â”œâ”€â”€ useDebounce.ts           # Value debouncing hook
â”‚   â”‚   â”œâ”€â”€ useKeyboardManager.ts    # Global keybinding dispatcher (Ctrl+S, Ctrl+P, Ctrl+`, etc.)
â”‚   â”‚   â””â”€â”€ useVoiceChat.ts          # WebRTC mesh voice client hook with Google STUN
â”‚   â””â”€â”€ lib/
â”‚       â”œâ”€â”€ cache-utils.ts           # In-memory query cache with TTL invalidation
â”‚       â”œâ”€â”€ commands.ts              # Command palette registry
â”‚       â”œâ”€â”€ config.ts                # Centralized environment URL configuration & auto-failover
â”‚       â”œâ”€â”€ data-service.ts          # Master data layer bridging Supabase, Server, and Mock
â”‚       â”œâ”€â”€ sound.ts                 # Web Audio API procedural sound synthesizer
â”‚       â”œâ”€â”€ storage-mock.ts          # Client-side localStorage persistence layer
â”‚       â”œâ”€â”€ themes.ts                # Theme token definitions (Monaco themes, UI palettes)
â”‚       â”œâ”€â”€ types.ts                 # TypeScript type definitions across the entire system
â”‚       â”œâ”€â”€ collaboration/
â”‚       â”‚   â”œâ”€â”€ comment-service.ts   # Inline code comments & pull request manager
â”‚       â”‚   â””â”€â”€ types.ts             # Review and comment data types
â”‚       â”œâ”€â”€ extensions/
â”‚       â”‚   â”œâ”€â”€ registry.ts          # Extensions catalog registry
â”‚       â”‚   â””â”€â”€ types.ts             # Extension specification interfaces
â”‚       â”œâ”€â”€ integrations/
â”‚       â”‚   â”œâ”€â”€ integration-manager.ts # Deployment and cloud integration client
â”‚       â”‚   â””â”€â”€ types.ts             # Integration provider interfaces
â”‚       â””â”€â”€ supabase/
â”‚           â”œâ”€â”€ client.ts            # Browser Supabase client instance
â”‚           â”œâ”€â”€ server.ts            # Server-side Supabase client instance using cookies
â”‚           â””â”€â”€ profile-utils.ts     # Metadata normalization for Google/GitHub OAuth users
â”‚
â””â”€â”€ supabase/                        # SQL Migrations & Database DDL
    â”œâ”€â”€ schema.sql                   # Base schema: profiles, projects, members, files, messages
    â”œâ”€â”€ schema_v6.sql                # Media columns, activities target object, storage bucket
    â”œâ”€â”€ schema_v9.sql                # Coding partners & notifications tables with RLS
    â”œâ”€â”€ schema_v10_auth_profiles.sql # Safe additive OAuth profiles migration & handle_new_user trigger
    â””â”€â”€ schema_v11_performance_indexes.sql # Rapid lookup B-tree indexes for zero N+1 latency
```

---

## 7. Authentication

### Architecture
- **Auth Provider:** Supabase GoTrue Auth.
- **Supported Methods:**
  1. **Email / Password:** Standard email signup with optional email confirmation.
  2. **Google OAuth:** PKCE flow via Google Cloud OAuth Client ID.
  3. **GitHub OAuth:** PKCE flow via GitHub Developer Application Client ID.
  4. **Account Linking:** `linkIdentity(provider)` allows users to link both Google and GitHub to a single account.

### End-to-End Authentication Flow
```text
[User Clicks "Sign in with Google / GitHub"]
       â”‚
       â–¼
Supabase Client initiates OAuth (PKCE Flow)
Redirects browser to provider consent screen:
redirect_to = http://localhost:3000/auth/callback (or production origin)
       â”‚
       â–¼
User completes consent on Google / GitHub
Provider redirects to /auth/callback?code=AUTH_CODE
       â”‚
       â–¼
Next.js Route Handler (/src/app/auth/callback/route.ts):
1. Reads `code` from query parameters.
2. Calls `supabase.auth.exchangeCodeForSession(code)` to set auth cookies.
3. Extracts User object and calls `normalizeOAuthUser(user)`:
   - Derives full_name, display_name, avatar_url, username, and github_username.
4. Queries existing `profiles` record:
   - If missing: inserts new profile row with OAuth metadata.
   - If exists: non-destructively updates only empty/default fields, preserving custom user edits.
5. Redirects to target destination (`/?` or `/project/[id]`).
       â”‚
       â–¼
AuthContext (`src/context/AuthContext.tsx`):
- `supabase.auth.onAuthStateChange` fires.
- Synchronizes user state into React Context and `StorageMock`.
```

### Route Protection & Middleware
- Implemented in `src/middleware.ts` using `@supabase/ssr`.
- Private projects (`/project/[id]`) and Settings (`/settings`) require authenticated sessions.
- Unauthenticated requests are redirected to `/login?next=<pathname>`.
- Static assets (`.css`, `.js`, `.png`, fonts) are excluded via regex matcher to prevent cache corruption.

---

## 8. Profiles & Identity System

### Profile Schema (`public.profiles`)
- `id` (UUID, Primary Key, references `auth.users.id`)
- `email` (TEXT, Not Null)
- `full_name` (TEXT)
- `display_name` (TEXT)
- `username` (TEXT, Unique)
- `avatar_url` (TEXT)
- `bio` (TEXT)
- `role` (TEXT, default: 'Developer')
- `location` (TEXT)
- `education` (TEXT)
- `website` (TEXT)
- `github_username` (TEXT)
- `linkedin_url` (TEXT)
- `skills` (TEXT[])
- `languages` (TEXT[])
- `technologies` (TEXT[])
- `collaboration_interests` (TEXT[])
- `other_links` (JSONB)
- `readme_markdown` (TEXT)
- `pinned_project_ids` (TEXT[], max 4)
- `privacy` (JSONB)
- `preferences` (JSONB)
- `created_at` & `updated_at` (TIMESTAMPTZ)

### Identity Features
1. **Public Profile Route (`/profile/[username]`):** Publicly viewable developer resume. Renders bio, skills, technologies, custom Markdown README, and pinned projects.
2. **Privacy Enforcement:** Sensitive fields (`email`, `location`, `education`, `links`, `skills`, `readme`) respect user privacy toggles in `privacy` JSONB when viewed by other developers.
3. **52-Week Contribution Calendar:** Computes an aggregated activity heatmap (365 days) from the `activities` table with longest streak and current streak calculations, cached with a 5-minute TTL.

---

## 9. Projects & Workspaces

### Storage Model
Radiux uses a **dual-layer filesystem model**:
1. **Database Representation (`public.files` & `public.projects`):** Every project, folder, and file is tracked in Supabase PostgreSQL with UUIDs, timestamps, and permissions.
2. **Host Workspace Filesystem (`.workspaces/<projectId>/`):** The backend Node server mirrors project files on the physical disk of the server or container:
   - When a user opens an IDE workspace, `WorkspaceManager.getWorkspaceDir(projectId)` ensures a directory exists at `.workspaces/<projectId>/`.
   - Files are synchronized to disk via `/api/sync-file` and `/api/sync-project`.
   - The PTY terminal process and Git subsystem run with `cwd` set to `.workspaces/<projectId>/`.

### Workspace Security
- `WorkspaceManager.sanitizeProjectId(projectId)` strips all non-alphanumeric characters to prevent directory traversal (`..` attacks).
- Paths are resolved and verified against `WORKSPACES_ROOT` before any read or write operation.

---

## 10. Code Editor

- **Engine:** Microsoft Monaco Editor (the core editor of VS Code).
- **Multi-Tab Interface:** Managed in `OpenTabs.tsx` with dirty indicator, file icons, and tab close handlers.
- **Language Detection:** Automatic language mapping for 35+ file extensions (`detectLanguage()`).
- **Autosave & Persistence:** Changes trigger debounced updates (400ms) to both Supabase PostgreSQL and local workspace disk.
- **Real-Time Multi-Cursor Collaboration:**
  - Integrated via `y-monaco` and `y-websocket`.
  - Room name format: `project-${projectId}-file-${file.id}`.
  - Remote cursors are rendered with distinct user colors (`getUserColor()`) and name tags.
- **Themes Supported:** 8 curated themes (Dark, Light, Midnight, Dracula, Monokai, Nord, Solarized, High Contrast).
- **Keyboard Shortcuts:** Full VS Code shortcut parity (`Ctrl+S` save, `Ctrl+P` Quick Open, `Ctrl+Shift+P` Command Palette, `Ctrl+\`` toggle terminal).

---

## 11. Terminal & Runtime

### Architecture
- **Frontend:** XTerm.js 6.0 with `FitAddon` for responsive resizing.
- **Transport:** Dedicated WebSocket endpoint at `/terminal?projectId=...&sessionId=...&profileId=...`.
- **Backend Daemon:** `node-pty` spawns genuine pseudo-terminal processes running on the host OS.

### Host Shell Support
| Operating System | Detected Shells | Default Shell | Notes |
| :--- | :--- | :--- | :--- |
| **Windows** | PowerShell 7 (`pwsh`), Windows PowerShell, CMD, Git Bash, WSL | PowerShell 7 (if installed) or Windows PowerShell | Includes `-ExecutionPolicy Bypass -NoLogo` args to allow `npm` and scripts to run freely. |
| **Linux / Render** | Bash (`/bin/bash`), Zsh (`/bin/zsh`), Sh (`/bin/sh`) | Bash | Runs with login shell args (`-l`). |

### Multi-Session Management
- Users can spawn multiple terminal tabs simultaneously.
- Sessions can be renamed, restarted, or killed.
- **Scrollback History Buffer:** Terminal output is buffered in memory so switching between sessions or reconnecting preserves terminal history.
- **Port Detection Engine:** Terminal stream output is scanned via regex (`PORT_REGEX`) for listening servers (e.g. `http://localhost:5000`). When detected, a notification is emitted and the preview dock is highlighted.

---

## 12. Terminal Issues & Mitigations

### Known Edge Cases Investigated:
1. **PowerShell Script Execution Policy (`npm.ps1` error):**
   - *Problem:* Windows blocks running unsigned scripts by default (`PSSecurityException`).
   - *Current Mitigation:* `detectProfiles()` in `workspace-manager.mjs` explicitly sets `args: ['-ExecutionPolicy', 'Bypass', '-NoLogo']` when spawning PowerShell processes.
2. **Process Cleanup on Disconnect:**
   - *Behavior:* When a terminal WebSocket disconnects, the PTY process is retained for a timeout period to prevent killing long-running dev servers if the user temporarily refreshes the browser. Explicit termination requires the user clicking the "Trash" icon.
3. **Control Key Combinations:**
   - Interactive key sequences (`Ctrl+C` SIGINT, `Ctrl+D` EOF, arrow keys, tab completion) are transmitted verbatim over the binary/text WebSocket stream to `ptyProcess.write()`.

---

## 13. Git & GitHub

### Implementation Details
- Managed by `server/git-manager.mjs` using native `git` CLI child processes.
- **Supported Operations:**
  - `git init -b main` (initializes repo with safe author defaults)
  - `git status --porcelain=v1` (inspects staged, unstaged, untracked changes)
  - `git add` / `git reset` (staging and unstaging individual or all files)
  - `git checkout -- <file>` (discarding working tree changes)
  - `git commit -m <message>` (committing with user credentials)
  - `git branch` (listing, creating, deleting, and switching branches)
  - `git merge <branch>` (merging branches)
  - `git log` (inspecting commit history)
  - `git diff` (side-by-side Monaco diff inspection)
  - `git remote` (configuring GitHub or other remotes)
  - `git push` / `git pull` (authenticated remote sync using GitHub Personal Access Tokens)

---

## 14. Collaboration & Social Features

### Coding Partners (Friend Requests)
- Model: `public.coding_partners` table in PostgreSQL + `.workspaces/data/partners.json` + `StorageMock`.
- **State Machine:**
  ```text
  [Send Request] â”€â”€â–º PENDING â”€â”€â”¬â”€â”€â–º ACCEPTED (Mutual Partners)
                               â”œâ”€â”€â–º REJECTED / DECLINED
                               â”œâ”€â”€â–º IGNORED
                               â””â”€â”€â–º CANCELLED (Unsent by requester)
  ```
- **Live Dispatch:** Sending a partner request immediately transmits a WebSocket event (`partner_request_received`) to the receiver if online, and records a persistent notification.

### Peer Presence & Awareness
- Visualized in `ProjectPresence.tsx` in the top header.
- Displays active collaborator avatars, live file locations, and connection status.
- Clicking a collaborator allows jumping to their active file or following their cursor.

---

## 15. Chat System

- **Scope:** Real-time project chat docked in the bottom panel (`ChatPanel.tsx`).
- **Data Model:** `public.messages` in Supabase PostgreSQL + `.workspaces/<projectId>/messages.json`.
- **Media Uploads:** Users can attach images, audio, video, or files. Images are automatically uploaded to Supabase Storage (`chat-media` bucket) and rendered inline with preview modal support.
- **Reactions & Formatting:** Markdown formatting, code snippets, timestamps, and emoji reactions.

---

## 16. Voice Communication

- **Technology:** Peer-to-peer WebRTC mesh network (`useVoiceChat.ts`).
- **Signaling Channel:** Carried over the persistent `/comm` WebSocket connection.
- **Audio Constraints:** 
  ```javascript
  { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  ```
- **STUN Infrastructure:** Google Public STUN servers (`stun.l.google.com:19302`).
- **UI:** Docked in the `VoicePanel.tsx` tab showing speaking indicators, mute status, and participant avatars.

---

## 17. Notification System

### Structure
- **Storage:** `public.notifications` table in Supabase PostgreSQL + `.workspaces/data/notifications.json` + `StorageMock`.
- **Delivery Mechanism:**
  1. **Push:** Real-time WebSocket event (`type: 'notification'`) dispatched directly to the recipient's connection.
  2. **Polling:** 10-second background fetch via `DataService.getNotifications()` ensuring delivery across disconnected tabs.
- **User Interface:**
  - **Top Navigation Indicator:** Subtle bell icon with an unread badge dot.
  - **Status Bar Indicator:** Footer bell icon with live unread counter.
  - **Slide-in Notification Center (`NotificationCenterPanel.tsx`):** Drawer displaying unread and historical notifications with "Accept", "Decline", and "Dismiss" actions.
- **Duplicate Prevention:**
  - Client utilizes `shownNotifIdsRef` to suppress re-triggering audio chimes or duplicate entries on re-polling.
  - Server enforces idempotency keys on notification records.

---

## 18. Dashboard

- Located at `/` (`src/app/page.tsx`).
- **Project Showcase:** Lists user's owned and collaborative workspaces with role badges (`Owner` / `Member`), last updated timestamps, and delete actions.
- **Quick Creation:** Template buttons (Blank Project, Node.js, Python, HTML5/CSS, React).
- **Import Workflows:** Import from GitHub public URL, or restore from ZIP workspace archive.
- **Developer Discovery Button:** Quick access to peer developer directory.

---

## 19. Settings System

- Accessible via `/settings` (`src/app/settings/page.tsx`) or `EditorSettingsModal.tsx`.
- **Editor Preferences:** Font size (10px - 28px), font family, tab size (2, 4, 8), word wrap, minimap toggle, line numbers.
- **Theme Selection:** Live preview switching between 8 custom themes.
- **Sound Effects:** Toggle for IDE UI audio chimes (chimes synthesized procedurally via Web Audio API).
- **Keybinding Configuration:** Shortcuts customization modal with conflict detection.

---

## 20. Deployment Architecture

### Current Status of Deployment Infrastructure
| Provider | Role | Status | Evidence |
| :--- | :--- | :--- | :--- |
| **Vercel** | Frontend Hosting (Next.js 14) | Configured | `.env.production`, `render.yaml`, `next.config.js` |
| **Render** | Backend Companion Service (Node/PTY) | Configured | `render.yaml` Blueprint (`radiux-backend`), `/health` check |
| **Supabase** | Auth, PostgreSQL Database, Storage | Active & Live | `https://your-project.supabase.co` |
| **GitHub** | Codebase VCS & OAuth Identity | Configured | `https://github.com/RyanKeshary/Radiux.git` |

### Audit of Network References (Ports & URLs)
| Pattern | File / Location | Classification | Assessment |
| :--- | :--- | :--- | :--- |
| `localhost:3000` | `.env.local`, `config.ts`, `AuthContext.tsx` | **LEGITIMATE** | Local development default for Next.js app. Auto-switches to `window.location.origin` in production. |
| `localhost:1234` | `.env.local`, `config.ts`, `websocket.mjs` | **LEGITIMATE** | Local development port for WebSocket & PTY server. Auto-switches to cloud URL on production host. |
| `127.0.0.1` | `websocket.mjs:505, 702` | **LEGITIMATE** | Internal loopback used by reverse proxy and port probe to reach user dev servers. |
| `codecollab-backend-isjt.onrender.com` | `config.ts:8-9`, `.env.production` | **PRODUCTION RISK** | Live Render instance URL containing old project name (*CodeCollab*). Functional, but needs updating when rebranded service is provisioned. |
| `code-collab-ide.vercel.app` | `render.yaml:38`, `config.ts:73` | **PRODUCTION RISK** | Old Vercel deployment domain. Current `.env.production` targets `radiux-ryankeshary-3251s-projects.vercel.app`. |

---

## 21. Database Architecture & ER Diagram

```text
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚       auth.users       â”‚
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                   â”‚ (1:1 cascade)
                   â–¼
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â”‚    public.profiles     â”‚â—„â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                    â”‚
                   â”‚ (1:N)                           â”‚
       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”‚
       â”‚                        â”‚                    â”‚
       â–¼                        â–¼                    â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚
â”‚   projects   â”‚         â”‚ notificationsâ”‚            â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
       â”‚                                             â”‚
       â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”‚
       â–¼                        â–¼                    â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚
â”‚    files     â”‚         â”‚project_members            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
       â”‚                                             â”‚
       â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                    â”‚
       â–¼                        â–¼                    â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚
â”‚   messages   â”‚         â”‚  activities  â”‚            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
                                                     â”‚
                                                     â”‚
                         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
                         â”‚    coding_partners     â”œâ”€â”€â”˜
                         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 22. Security Audit

### 1. Secrets & Credentials
- **Finding:** `.env.local` contains live API keys (`VERCEL_API_TOKEN`, `RENDER_API_KEY`, Supabase anon key).
- **Status:** `.env.local` is correctly listed in `.gitignore` and has not been committed to the repository.
- **Risk:** Supabase Publishable Anon Key is present in `.env.example` and `.env.production`. This is expected for client-side Supabase authentication and is secured via Row Level Security (RLS) policies on the database.

### 2. Terminal & Command Injection
- **Finding:** The PTY daemon executes arbitrary shell commands requested by users in the terminal.
- **Risk Level:** **HIGH in shared/multi-tenant cloud production**, acceptable in local developer environments.
- **Current Safeguards:**
  - `getSanitizedEnv()` strips all sensitive tokens, passwords, and Supabase credentials from the process environment before spawning shells.
  - Workspace directory paths are strictly bounded inside `.workspaces/<projectId>/`.
  - In cloud deployments, the backend runs inside an isolated container on Render.

### 3. Cross-Origin Resource Sharing (CORS)
- In development mode (`NODE_ENV !== 'production'`), CORS allows all origins.
- In production, `websocket.mjs` restricts origins to `ALLOWED_ORIGIN` and official Radiux Vercel domains (`*.vercel.app`).

### 4. Row Level Security (RLS)
- All public tables (`profiles`, `projects`, `project_members`, `files`, `messages`, `activities`, `coding_partners`, `notifications`) have RLS enabled with explicit `USING` and `WITH CHECK` clauses tied to `auth.uid()`.

---

## 23. UI Architecture & Visual Design System

### Layout Hierarchy
1. **Activity Bar (Left):** 48px vertical strip switching primary side panels:
   - Explorer (`Files`)
   - Source Control (`Git`)
   - Activity Timeline (`Feed`)
   - Extensions Marketplace (`Ext`)
   - Active Collaborators (`Peers`)
2. **Sidebar:** 260px collapsible panel displaying active side panel content.
3. **Editor Area:** Tab strip (`OpenTabs.tsx`) above Monaco Editor instance with floating Breadcrumbs.
4. **Bottom Dock:** Collapsible panel with tab bar:
   - Terminal (multi-session XTerm.js)
   - Output (build logs)
   - Problems (diagnostics)
   - Web Preview (integrated browser iframe)
   - Voice (WebRTC participants)
   - Chat (project conversation)
5. **Top Navigation Bar:** Project name, branch selector, Run button, Share/Invite, Collaborators presence, Notifications indicator, User Menu.

---

## 24. Feature Maturity Matrix

| Area | Implemented | Functional | Production Ready | Notes / Known Constraints |
| :--- | :---: | :---: | :---: | :--- |
| **Authentication** | **YES** | **YES** | **YES** | Google, GitHub, and Email/Password fully operational. |
| **Profiles & Identity** | **YES** | **YES** | **YES** | Handles, bio, skills, README, and contribution calendar working. |
| **Dashboard** | **YES** | **YES** | **YES** | Workspace listing, quick starters, and ZIP import functional. |
| **Project Creation** | **YES** | **YES** | **YES** | Dual persistence to Supabase and local storage. |
| **Monaco Editor** | **YES** | **YES** | **YES** | Tabs, 8 themes, syntax detection, and auto-persistence working. |
| **CRDT Collaboration** | **YES** | **YES** | **YES** | Yjs shared cursors and document sync operational. |
| **Terminal Subsystem** | **YES** | **YES** | **PARTIAL** | Functional PTY on host OS; lacks Docker container sandboxing. |
| **Git Source Control** | **YES** | **YES** | **YES** | Staging, commit, diff viewer, and branch switching functional. |
| **Dev Server Preview** | **YES** | **YES** | **YES** | Automatic port detection + `/proxy/:port/*` reverse proxy. |
| **Project Chat** | **YES** | **YES** | **YES** | Real-time messages + Supabase Storage media upload. |
| **WebRTC Voice** | **YES** | **YES** | **PARTIAL** | Functional peer-to-peer mesh; requires TURN server for symmetric NATs. |
| **Notifications** | **YES** | **YES** | **YES** | Indicator badges + drawer panel; popups removed as requested. |
| **Inline Comments** | **YES** | **YES** | **PARTIAL** | Real-time comment pins synced over `/comm`; not in Supabase DB. |
| **Pull Requests** | **YES** | **YES** | **PARTIAL** | Review request UI functional; backed by JSON store. |
| **Extensions Panel** | **YES** | **PARTIAL** | **NO** | Visual marketplace showcase; extensions do not execute arbitrary sandboxed code. |

---

## 25. Complete User Workflows

### 1. New User Registration & First Project
1. User navigates to `/login`.
2. Clicks "Continue with Google" or "Continue with GitHub".
3. Redirected to OAuth provider, approves permissions.
4. Provider redirects to `/auth/callback?code=...`.
5. Server exchanges code, creates profile row in PostgreSQL, sets session cookies.
6. User arrives at `/` (Dashboard).
7. Clicks "New Project", inputs "My App", clicks "Create Workspace".
8. Next.js creates database record and redirects to `/project/[id]`.
9. `Workspace.tsx` mounts, loads project files, connects to Yjs and Terminal WebSocket.

### 2. Coding & Live Collaboration
1. Owner clicks "Invite", searches for peer developer by username or email.
2. Peer receives live notification badge in header.
3. Peer accepts invite, opens project URL.
4. Peer's avatar appears in top navigation presence bar.
5. Both users open `index.js`. Monaco displays both cursors with name tags.
6. Changes synchronize character-by-character via Yjs CRDT with zero merge conflicts.

### 3. Terminal Execution & Web Preview
1. User clicks Terminal tab in bottom dock.
2. Node-pty spawns host shell (PowerShell on Windows, Bash on Linux).
3. User runs `npm run dev` or `python -m http.server 5000`.
4. Backend port detector identifies port `5000`.
5. Web Preview tab automatically highlights and loads `http://localhost:1234/proxy/5000/`.

---

## 26. Key Architecture Hardening Completed in Current Pass

1. **Terminal Profile Architecture & PowerShell Bypass:** Terminal sessions now dynamically detect all installed shells (PowerShell 7/pwsh, Windows PowerShell, CMD, Git Bash, WSL on Windows; Bash, Zsh, Sh on Linux). Added `PSExecutionPolicyPreference = 'Bypass'` and `.CMD;.BAT;.EXE` PATHEXT to resolve the `npm.ps1` ExecutionPolicy failure. Added shell profile switching and auto-recovery on Enter.
2. **Terminal Dock Cleanup:** Completely eliminated the Activity/Feed concept from the terminal bottom dock; preserved it cleanly in a dedicated Activity Bar sidebar view (`ActivityFeed.tsx`).
3. **Collaborative Cursor Awareness & Styling:** Fixed invisible/nameless remote cursors by injecting client-specific dynamic CSS styles with remote user name badges and user colors. Added an explicit user toggle (`showCollaboratorCursors`) with `.hide-remote-cursors` CSS suppression.
4. **Notification System Rebuild & Activity Separation:** Enforced strict separation between presence events (online/offline), activity events (file edit, timeline audit), and notification events (attention-worthy actions). Eliminated fake unread notification injection from `showToast`. Rendered `NotificationToastContainer` for transient alerts. Enforced deterministic idempotency keys across server and client.
5. **Password Reset Route (`/auth/reset-password`):** Implemented the missing password reset page with live validation, password confirmation, Supabase recovery session listener, and redirection.
6. **OAuth Profile Field Protection:** Refactored OAuth callback profile synchronization from destructive upsert to targeted `.update()` on existing profiles, guaranteeing custom bio, skills, and settings are never overwritten.
7. **Voice Signaling Optimization:** Reconfigured `useVoiceChat.ts` to open signaling WebSockets strictly on-demand during active voice calls, eliminating duplicate connections during regular editing sessions. Documented TURN server requirements and handled ICE failure gracefully.
8. **Branding & Configuration Cleanup:** Replaced obsolete `[CodeCollab]` references in `server/websocket.mjs` and `server/git-manager.mjs` with `[Radiux]`. Updated default git author to `Radiux Developer <developer@radiux.dev>`.

---

## 27. Remaining Known Limitations (Honest Assessment)

1. **Terminal Host Process Isolation (Container Sandboxing):** Terminals currently run directly on the host operating system with environment sanitization and workspace boundary constraints. In untrusted public multi-tenant environments, full containerization (microVMs or Docker containers) is recommended before general public access.
2. **WebRTC NAT Traversal (TURN Server):** Voice chat utilizes public Google STUN servers. Restrictive enterprise firewalls or symmetric NATs will fail direct P2P audio without a dedicated TURN relay (e.g. Coturn).
3. **Dual Persistence Consolidation:** Comments, reviews, and direct messages currently persist to `.workspaces/data/` JSON files and `StorageMock` rather than dedicated Supabase PostgreSQL tables with foreign key constraints.
4. **Monaco Dynamic Bundle Optimization:** Monaco Editor bundles represent ~300KB of initial client-side JavaScript that could benefit from progressive route chunking.

---

## 28. Verification Record

- **TypeScript Verification:** `npx tsc --noEmit` executed with **exit code 0** (0 type errors across all files).
- **Next.js Production Build:** `npm run build` executed with **exit code 0** (all 9 routes compiled cleanly, including new `/auth/reset-password`).
- **Interactive Terminal Verification:** Tested interactive command execution via WebSocket â€” `node -v` (v24.19.0) and `npm -v` (11.17.0) executed cleanly without PowerShell execution policy errors.
- **Shell Profile Switching Verification:** Tested `cmd.exe` profile execution â€” successfully spawned CMD session, ran `echo RADIUX_CMD_OK` and verified output.
- **Git Integration Verification:** Tested `/api/git/init` and `/api/git/status` â€” successfully initialized Git repository with default branch `main`.
- **Notification Deduplication Verification:** Tested `/comm` notifications with deterministic idempotency keys â€” 3 repeated dispatches collapsed to exactly 1 persisted record.
- **Backend Health Verification:** `http://127.0.0.1:1234/health` returns `{ "status": "ok", "product": "radiux", "service": "radiux-backend" }`.
- **Git Status:** Clean and synchronized on branch `main`.
