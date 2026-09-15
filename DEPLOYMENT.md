# CodeCollab — Production Deployment Guide

This document describes the production deployment architecture and step-by-step setup for CodeCollab.

---

## 1. Production Architecture Overview

```text
                         INTERNET
                            │
                            ▼
                  ┌────────────────────┐
                  │      Vercel        │
                  │   Next.js Frontend │
                  └─────────┬──────────┘
                            │
                     HTTPS / WSS
                            │
                            ▼
                  ┌────────────────────┐
                  │       Render       │
                  │   Node Backend     │
                  │                    │
                  │ WebSockets         │
                  │ Terminal / PTY     │
                  │ Git                │
                  │ Workspace          │
                  │ Dev Server Proxy   │
                  │ REST API           │
                  └─────────┬──────────┘
                            │
                            ▼
                  ┌────────────────────┐
                  │     Supabase       │
                  │                    │
                  │ Auth               │
                  │ PostgreSQL         │
                  │ Storage            │
                  │ Realtime           │
                  └────────────────────┘
```

### Hosting Roles & Responsibilities

1. **Vercel**
   - Hosts the Next.js 14 App Router frontend.
   - Serves static assets, client bundles, Monaco editor, and client-side application logic.

2. **Render (Web Service)**
   - Runs `node server/websocket.mjs` as a persistent, long-running Node.js process.
   - Handles Yjs document CRDT synchronization via WebSockets.
   - Spawns interactive Linux pseudo-terminals (`node-pty`) inside isolated project workspaces.
   - Executes server-side Git commands (`git status`, `git commit`, `git push`, etc.).
   - Serves static web previews (`/preview/:projectId/*`).
   - Reverse-proxies dynamic dev servers running on Render (`/proxy/:port/*`).
   - Relays WebRTC voice signaling messages and real-time chat/activity broadcasts.
   - Exposes `/health` check endpoint for uptime monitoring.

3. **Supabase**
   - Cloud PostgreSQL database storing profiles, projects, members, files, messages, and activities.
   - Handles email/password, Google OAuth, and GitHub OAuth user authentication.
   - Enforces database Row Level Security (RLS) policies.
   - Houses public storage bucket (`chat-media`) for file attachments.

---

## 2. Environment Variables Specification

### Vercel (Frontend)

Set these environment variables in your Vercel Project Settings (**Settings** -> **Environment Variables**):

| Variable | Description | Example Production Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://rdhwzezrmgkgsbpwznrz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase client anon key | `sb_publishable_...` |
| `NEXT_PUBLIC_APP_URL` | Public production frontend URL | `https://code-collab-ide.vercel.app` |
| `NEXT_PUBLIC_WS_URL` | Public WSS URL of Render backend | `wss://codecollab-backend-isjt.onrender.com` |
| `NEXT_PUBLIC_API_URL` | Public HTTPS URL of Render backend | `https://codecollab-backend-isjt.onrender.com` |

> [!CAUTION]
> **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to Vercel or any `NEXT_PUBLIC_*` variable. It must remain strictly server-side on Render.

### Render (Backend)

Set these environment variables in your Render Web Service dashboard (**Environment**):

| Variable | Description | Value / Example |
|---|---|---|
| `PORT` | Dynamically assigned port (or defaults to 10000) | `10000` |
| `NODE_ENV` | Node production environment flag | `production` |
| `ALLOWED_ORIGIN` | Allowed CORS origins (comma-separated if multiple) | `https://code-collab-ide.vercel.app,https://codecollab-ide-kappa.vercel.app,http://localhost:3000` |
| `SUPABASE_URL` | Your Supabase project URL | `https://rdhwzezrmgkgsbpwznrz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret | `<your-supabase-service-role-secret>` |

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Render Web Service Setup (Backend)

1. Sign in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service** (or use Blueprint with `render.yaml`).
3. Connect your GitHub repository (`https://github.com/RyanKeshary/web-ide.git`).
4. Configure service settings:
   - **Name**: `codecollab-backend`
   - **Region**: Oregon (or your preferred region)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/websocket.mjs`
   - **Health Check Path**: `/health`
5. Add the Environment Variables listed in Section 2 under **Environment**.
6. Click **Create Web Service**.
7. Once deployment succeeds, note your Render URL:
   - HTTPS: `https://codecollab-backend.onrender.com`
   - WSS: `wss://codecollab-backend.onrender.com`

### Step 2: Vercel Setup (Frontend)

1. Sign in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`https://github.com/RyanKeshary/web-ide.git`).
4. In the **Configure Project** screen:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `next build` (default)
   - **Output Directory**: `.next` (default)
5. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://rdhwzezrmgkgsbpwznrz.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `sb_publishable_LJNOLmfuxnsbaxnRBcbQNg_TLDDbUfL`
   - `NEXT_PUBLIC_APP_URL`: `https://code-collab-ide.vercel.app`
   - `NEXT_PUBLIC_WS_URL`: `wss://codecollab-backend-isjt.onrender.com`
   - `NEXT_PUBLIC_API_URL`: `https://codecollab-backend-isjt.onrender.com`
6. Click **Deploy**.
7. Production URL: `https://code-collab-ide.vercel.app`.

### Step 3: Update CORS on Render

Once your Vercel URL is generated:
1. Return to the Render Web Service -> **Environment**.
2. Set `ALLOWED_ORIGIN` to your Vercel domain:
   ```text
   ALLOWED_ORIGIN=https://code-collab-ide.vercel.app,https://codecollab-ide-kappa.vercel.app,http://localhost:3000
   ```
3. Save changes; Render will redeploy automatically.

### Step 4: Supabase Authentication Configuration

1. In the [Supabase Dashboard](https://supabase.com/dashboard) -> Select your project -> **Authentication** -> **URL Configuration**:
   - **Site URL**: `https://code-collab-ide.vercel.app`
   - **Redirect URLs**:
     ```text
     https://code-collab-ide.vercel.app/**
     https://code-collab-ide.vercel.app/auth/callback
     http://localhost:3000/**
     ```
2. **Google OAuth** (if enabled):
   - In Google Cloud Console -> APIs & Services -> Credentials -> Authorized redirect URIs:
     Add: `https://rdhwzezrmgkgsbpwznrz.supabase.co/auth/v1/callback`
3. **GitHub OAuth** (if enabled):
   - In GitHub Settings -> Developer settings -> OAuth Apps:
     - Homepage URL: `https://code-collab-ide.vercel.app`
     - Authorization callback URL: `https://rdhwzezrmgkgsbpwznrz.supabase.co/auth/v1/callback`

---

## 4. Key Production Features & Security Architecture

### Health Check Endpoint
Render automatically verifies server readiness using:
```http
GET /health
```
Response:
```json
{
  "status": "ok",
  "service": "codecollab-backend"
}
```

### Dynamic Dev Server Reverse Proxy
Because Render containers do not expose internal ports (e.g., `3000`, `5000`, `8080`) directly to client browsers over the internet, CodeCollab includes a streaming reverse proxy on the backend:
```http
GET /proxy/:port/:path*
```
When a developer launches a server in the interactive terminal, the IDE's Web Preview accesses it through:
```text
https://<render-backend>/proxy/<port>/
```
This enables full dynamic server previews over HTTPS from any device without requiring `localhost`.

### Terminal & Environment Security
- User terminal sessions inherit **sanitized** environment variables.
- All secrets, database keys, service-role keys, and tokens (`SUPABASE_*`, `*KEY*`, `*SECRET*`, etc.) are automatically stripped before pseudo-terminals spawn.
- Workspace file paths are validated against directory traversal attacks; projects cannot escape `.workspaces/<projectId>`.

### Filesystem Durability Note
Render Web Services have ephemeral local disk storage on restart. CodeCollab uses the Supabase database as the primary durable source of truth for all project files, while using `.workspaces/` on disk for active runtime execution, Git operations, and terminal tasks.

### Graceful Shutdown
The backend listens for `SIGTERM` and `SIGINT` signals from Render, cleanly terminating child PTY processes and active client WebSocket connections before exiting.
