import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_SECRET = 'super-secret-hmac-key-for-api-tests-12345';
const TEST_PASSWORD = 'TestPassword123!';
const LEAD_EMAIL = 'ryankeshary@gmail.com';

describe('API Routes Security Guards & RBAC', () => {
  let generateAdminToken: typeof import('@/lib/admin/admin-auth').generateAdminToken;
  let validAdminToken: string;

  beforeEach(async () => {
    vi.resetModules();
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
    process.env.ADMIN_SECRET = TEST_SECRET;
    process.env.ADMIN_EMAIL = LEAD_EMAIL;

    const adminAuth = await import('@/lib/admin/admin-auth');
    generateAdminToken = adminAuth.generateAdminToken;
    validAdminToken = generateAdminToken(LEAD_EMAIL, 'lead_admin');
  });

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_EMAIL;
  });

  describe('/api/admin/health Security Guard', () => {
    it('should reject unauthenticated request with 403 Forbidden', async () => {
      const { GET } = await import('@/app/api/admin/health/route');
      const req = new NextRequest('http://localhost:3000/api/admin/health');
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('should permit request with valid admin bearer token', async () => {
      const { GET } = await import('@/app/api/admin/health/route');
      const req = new NextRequest('http://localhost:3000/api/admin/health', {
        headers: {
          authorization: `Bearer ${validAdminToken}`,
        },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.components).toBeDefined();
      expect(data.components.frontend).toBeDefined();
      expect(data.components.frontend.status).toBe('HEALTHY');
    });
  });

  describe('/api/admin/users Security Guard', () => {
    it('should reject unauthenticated request with 401 or 403', async () => {
      const { GET } = await import('@/app/api/admin/users/route');
      const req = new NextRequest('http://localhost:3000/api/admin/users');
      const res = await GET(req);
      expect([401, 403]).toContain(res.status);
    });

    it('should authenticate request with valid admin token', async () => {
      const { GET } = await import('@/app/api/admin/users/route');
      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: {
          authorization: `Bearer ${validAdminToken}`,
        },
      });
      const res = await GET(req);
      // Valid admin token passes auth guard (200 with db or 503 if remote db offline)
      expect([200, 503]).toContain(res.status);
    });
  });

  describe('/api/admin/metrics Security Guard', () => {
    it('should reject unauthenticated request with 401 or 403', async () => {
      const { GET } = await import('@/app/api/admin/metrics/route');
      const req = new NextRequest('http://localhost:3000/api/admin/metrics');
      const res = await GET(req);
      expect([401, 403]).toContain(res.status);
    });

    it('should authenticate request with valid admin token', async () => {
      const { GET } = await import('@/app/api/admin/metrics/route');
      const req = new NextRequest('http://localhost:3000/api/admin/metrics', {
        headers: {
          authorization: `Bearer ${validAdminToken}`,
        },
      });
      const res = await GET(req);
      // Valid admin token passes auth guard (200 with db or 503 if remote db offline)
      expect([200, 503]).toContain(res.status);
    });
  });

  describe('/api/admin/audit Security Guard', () => {
    it('should reject unauthenticated request with 401 or 403', async () => {
      const { GET } = await import('@/app/api/admin/audit/route');
      const req = new NextRequest('http://localhost:3000/api/admin/audit');
      const res = await GET(req);
      expect([401, 403]).toContain(res.status);
    });

    it('should permit request with valid admin token', async () => {
      const { GET } = await import('@/app/api/admin/audit/route');
      const req = new NextRequest('http://localhost:3000/api/admin/audit', {
        headers: {
          authorization: `Bearer ${validAdminToken}`,
        },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.logs).toBeDefined();
      expect(Array.isArray(data.logs)).toBe(true);
    });
  });

  describe('/api/analytics Telemetry Endpoints', () => {
    it('should accept valid event analytics payload', async () => {
      const { POST } = await import('@/app/api/analytics/event/route');
      const req = new NextRequest('http://localhost:3000/api/analytics/event', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'test_action',
          category: 'editor',
          timestamp: new Date().toISOString(),
        }),
      });
      const res = await POST(req);
      expect([200, 201]).toContain(res.status);
    });

    it('should accept valid error analytics payload', async () => {
      const { POST } = await import('@/app/api/analytics/error/route');
      const req = new NextRequest('http://localhost:3000/api/analytics/error', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Test client error',
          subsystem: 'workspace_editor',
          stack: 'Error: test\n at Test',
        }),
      });
      const res = await POST(req);
      expect([200, 201]).toContain(res.status);
    });
  });
});
