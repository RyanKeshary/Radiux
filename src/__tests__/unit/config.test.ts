import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export config object with required properties', async () => {
    const config = await import('@/lib/config');
    expect(config.config).toBeDefined();
    expect(config.config.wsUrl).toBeDefined();
    expect(config.config.apiUrl).toBeDefined();
    expect(config.config.appUrl).toBeDefined();
  });

  it('should have buildWsUrl and buildApiUrl functions', async () => {
    const config = await import('@/lib/config');
    expect(typeof config.buildWsUrl).toBe('function');
    expect(typeof config.buildApiUrl).toBe('function');
  });

  it('should build WebSocket URL with path', async () => {
    const config = await import('@/lib/config');
    const url = config.buildWsUrl('/terminal');
    expect(url).toContain('/terminal');
    expect(url).toMatch(/^wss?:\/\//);
  });

  it('should build API URL with query parameters', async () => {
    const config = await import('@/lib/config');
    const url = config.buildApiUrl('/api/messages', { projectId: '123' });
    expect(url).toContain('/api/messages');
    expect(url).toContain('projectId=123');
  });

  it('should build URL without query params when none provided', async () => {
    const config = await import('@/lib/config');
    const url = config.buildApiUrl('/api/health');
    expect(url).not.toContain('?');
  });

  it('should convert WS URL to HTTP', async () => {
    const config = await import('@/lib/config');
    expect(config.wsToHttp('wss://example.com')).toBe('https://example.com');
    expect(config.wsToHttp('ws://localhost:1234')).toBe('http://localhost:1234');
  });

  it('should convert HTTP URL to WS', async () => {
    const config = await import('@/lib/config');
    expect(config.httpToWs('https://example.com')).toBe('wss://example.com');
    expect(config.httpToWs('http://localhost:1234')).toBe('ws://localhost:1234');
  });

  it('should use environment variables when available', async () => {
    process.env.NEXT_PUBLIC_WS_URL = 'wss://custom-ws.example.com';
    process.env.NEXT_PUBLIC_API_URL = 'https://custom-api.example.com';

    const config = await import('@/lib/config');
    expect(config.config.wsUrl).toBe('wss://custom-ws.example.com');
    expect(config.config.apiUrl).toBe('https://custom-api.example.com');
  });

  it('should use default values when env vars are not set', async () => {
    delete process.env.NEXT_PUBLIC_WS_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    const config = await import('@/lib/config');
    // In jsdom, window exists so it may use cloud backend
    expect(config.config.wsUrl).toBeTruthy();
    expect(config.config.apiUrl).toBeTruthy();
  });

  it('should have wakeUpBackend function', async () => {
    const config = await import('@/lib/config');
    expect(typeof config.wakeUpBackend).toBe('function');
  });

  it('should have CLOUD_BACKEND constants', async () => {
    const config = await import('@/lib/config');
    expect(config.CLOUD_BACKEND_WS).toContain('wss://');
    expect(config.CLOUD_BACKEND_API).toContain('https://');
  });

  it('should allow setting wsUrl and apiUrl via config object', async () => {
    const config = await import('@/lib/config');
    const originalWs = config.config.wsUrl;
    const originalApi = config.config.apiUrl;

    config.config.wsUrl = 'wss://test.example.com';
    config.config.apiUrl = 'https://test.example.com';

    expect(config.config.wsUrl).toBe('wss://test.example.com');
    expect(config.config.apiUrl).toBe('https://test.example.com');

    // Restore
    config.config.wsUrl = originalWs;
    config.config.apiUrl = originalApi;
  });
});
