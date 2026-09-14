/**
 * CodeCollab Level 6 — Centralized runtime configuration
 *
 * All environment-specific URLs and settings live here.
 * Never construct WebSocket or API URLs inline — always use these helpers.
 */

/** WebSocket base URL (Yjs sync, chat, terminal, voice signaling) */
export const WS_URL: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) ||
  'ws://localhost:1234';

/** HTTP API base URL (Git operations, file sync, preview) */
export const API_URL: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:1234';

/** Deployed app URL — used for OAuth redirects */
export const APP_URL: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

/** Convert a WS URL to its HTTP equivalent (for API calls on the same server) */
export function wsToHttp(wsUrl: string): string {
  return wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

/** Convert an HTTP URL to its WS equivalent */
export function httpToWs(httpUrl: string): string {
  return httpUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

/**
 * Build a WebSocket connection URL for a given path.
 * Handles both ws:// and wss:// base URLs correctly.
 */
export function buildWsUrl(path: string, params: Record<string, string> = {}): string {
  const base = WS_URL.replace(/\/$/, '');
  const qs = new URLSearchParams(params).toString();
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}

/**
 * Build an HTTP API URL for a given path.
 */
export function buildApiUrl(path: string, params: Record<string, string> = {}): string {
  const base = API_URL.replace(/\/$/, '');
  const qs = new URLSearchParams(params).toString();
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}

export const config = {
  wsUrl: WS_URL,
  apiUrl: API_URL,
  appUrl: APP_URL,
  buildWsUrl,
  buildApiUrl,
};
