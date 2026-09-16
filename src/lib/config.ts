/**
 * Radiux — Centralized runtime configuration
 *
 * All environment-specific URLs and settings live here.
 * Never construct WebSocket or API URLs inline — always use these helpers.
 */

export const CLOUD_BACKEND_WS = 'wss://codecollab-backend-isjt.onrender.com';
export const CLOUD_BACKEND_API = 'https://codecollab-backend-isjt.onrender.com';

/** WebSocket base URL (Yjs sync, chat, terminal, voice signaling) */
export let WS_URL: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) ||
  'ws://localhost:1234';

/** HTTP API base URL (Git operations, file sync, preview) */
export let API_URL: string =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:1234';

// Intelligent browser environment detection
if (typeof window !== 'undefined') {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // If deployed in production, never attempt to connect to localhost
  if (!isLocalHost) {
    if (WS_URL.includes('localhost') || WS_URL.includes('127.0.0.1')) {
      WS_URL = CLOUD_BACKEND_WS;
      API_URL = CLOUD_BACKEND_API;
    }
  }
}

/** Deployed app URL — used for OAuth redirects */
export const APP_URL: string =
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? window.location.origin
    : (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'));

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

/**
 * Non-blocking keep-alive ping to wake up container or keep it warm
 */
export async function wakeUpBackend(): Promise<boolean> {
  try {
    const res = await fetch(buildApiUrl('/health'), { mode: 'cors' });
    return res.ok;
  } catch (e) {
    // If local was targeted and failed, switch to cloud backend
    if (WS_URL.includes('localhost') && typeof window !== 'undefined') {
      try {
        const cloudRes = await fetch(CLOUD_BACKEND_API + '/health', { mode: 'cors' });
        if (cloudRes.ok) {
          WS_URL = CLOUD_BACKEND_WS;
          API_URL = CLOUD_BACKEND_API;
          config.wsUrl = WS_URL;
          config.apiUrl = API_URL;
          return true;
        }
      } catch (err) {}
    }
    return false;
  }
}

// Automatically trigger background wake-up on client mount
if (typeof window !== 'undefined') {
  wakeUpBackend();
}

export const config = {
  get wsUrl() { return WS_URL; },
  set wsUrl(val: string) { WS_URL = val; },
  get apiUrl() { return API_URL; },
  set apiUrl(val: string) { API_URL = val; },
  appUrl: APP_URL,
  buildWsUrl,
  buildApiUrl,
  wakeUpBackend,
};
