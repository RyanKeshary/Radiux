import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// Setup environment before importing admin-auth
const TEST_PASSWORD = 'TestAdminSecretPassword123!';
const TEST_SECRET = 'super-secret-hmac-key-for-testing-12345';
const LEAD_EMAIL = 'ryankeshary@gmail.com';

describe('Admin Authentication & Cryptography', () => {
  let adminAuth: typeof import('@/lib/admin/admin-auth');

  beforeEach(async () => {
    vi.resetModules();
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
    process.env.ADMIN_SECRET = TEST_SECRET;
    process.env.ADMIN_EMAIL = LEAD_EMAIL;
    adminAuth = await import('@/lib/admin/admin-auth');
  });

  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_EMAIL;
  });

  describe('Configuration & Identity checks', () => {
    it('should report admin auth configured when password and secret are present', () => {
      expect(adminAuth.isAdminAuthConfigured()).toBe(true);
    });

    it('should identify lead admin email correctly', () => {
      expect(adminAuth.isLeadAdminEmail(LEAD_EMAIL)).toBe(true);
      expect(adminAuth.isLeadAdminEmail('  RYANKESHARY@GMAIL.COM  ')).toBe(true);
      expect(adminAuth.isLeadAdminEmail('hacker@example.com')).toBe(false);
      expect(adminAuth.isLeadAdminEmail(null)).toBe(false);
      expect(adminAuth.isLeadAdminEmail(undefined)).toBe(false);
    });

    it('should verify admin list includes lead admin', () => {
      const list = adminAuth.getAdminList();
      expect(list.some(a => a.email.toLowerCase() === LEAD_EMAIL.toLowerCase())).toBe(true);
      const lead = list.find(a => a.email.toLowerCase() === LEAD_EMAIL.toLowerCase());
      expect(lead?.role).toBe('lead_admin');
    });

    it('should identify user admin role from user object', () => {
      expect(adminAuth.isUserAdmin({ email: LEAD_EMAIL, role: 'user' })).toBe(true);
      expect(adminAuth.isUserAdmin({ email: 'user@example.com', role: 'admin' })).toBe(true);
      expect(adminAuth.isUserAdmin({ email: 'user@example.com', role: 'lead_admin' })).toBe(true);
      expect(adminAuth.isUserAdmin({ email: 'normal@example.com', role: 'user' })).toBe(false);
      expect(adminAuth.isUserAdmin(null)).toBe(false);
    });
  });

  describe('Master Admin Credentials Validation', () => {
    it('should accept valid master admin credentials with username', () => {
      expect(adminAuth.validateMasterAdmin('admin', TEST_PASSWORD)).toBe(true);
    });

    it('should accept valid master admin credentials with lead admin email', () => {
      expect(adminAuth.validateMasterAdmin(LEAD_EMAIL, TEST_PASSWORD)).toBe(true);
    });

    it('should reject invalid password', () => {
      expect(adminAuth.validateMasterAdmin('admin', 'wrong-password')).toBe(false);
      expect(adminAuth.validateMasterAdmin(LEAD_EMAIL, 'wrong-password')).toBe(false);
    });

    it('should reject empty or missing parameters', () => {
      expect(adminAuth.validateMasterAdmin('', TEST_PASSWORD)).toBe(false);
      expect(adminAuth.validateMasterAdmin('admin', '')).toBe(false);
      expect(adminAuth.validateMasterAdmin('', '')).toBe(false);
    });

    it('should reject non-admin identifiers even with valid password', () => {
      expect(adminAuth.validateMasterAdmin('random@example.com', TEST_PASSWORD)).toBe(false);
    });
  });

  describe('Master Admin HMAC Token Lifecycle & Cryptography', () => {
    it('should generate a valid formatted admin token', () => {
      const token = adminAuth.generateAdminToken(LEAD_EMAIL, 'lead_admin');
      expect(token).toMatch(/^rad_adm\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('should verify a freshly generated admin token', () => {
      const token = adminAuth.generateAdminToken(LEAD_EMAIL, 'lead_admin');
      const verified = adminAuth.verifyMasterAdminToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.role).toBe('lead_admin');
      expect(verified.email?.toLowerCase()).toBe(LEAD_EMAIL.toLowerCase());
    });

    it('should reject tampered HMAC signature', () => {
      const token = adminAuth.generateAdminToken(LEAD_EMAIL, 'lead_admin');
      const parts = token.split('.');
      // Tamper signature by changing last character
      const tamperedSig = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

      const verified = adminAuth.verifyMasterAdminToken(tamperedToken);
      expect(verified.valid).toBe(false);
    });

    it('should reject tampered payload even if valid base64', () => {
      const token = adminAuth.generateAdminToken(LEAD_EMAIL, 'lead_admin');
      const parts = token.split('.');
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.role = 'lead_admin';
      payload.email = 'attacker@evil.com';
      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const verified = adminAuth.verifyMasterAdminToken(tamperedToken);
      expect(verified.valid).toBe(false);
    });

    it('should reject expired admin tokens', () => {
      const expiredPayload = {
        role: 'lead_admin',
        email: LEAD_EMAIL,
        userId: 'admin-lead-root',
        exp: Date.now() - 10000, // 10 seconds ago
      };
      const payloadBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const signature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(payloadBase64)
        .digest('base64url');
      const expiredToken = `rad_adm.${payloadBase64}.${signature}`;

      const verified = adminAuth.verifyMasterAdminToken(expiredToken);
      expect(verified.valid).toBe(false);
    });

    it('should reject malformed tokens cleanly without crashing', () => {
      expect(adminAuth.verifyMasterAdminToken('')).toEqual({ valid: false });
      expect(adminAuth.verifyMasterAdminToken('not-a-token')).toEqual({ valid: false });
      expect(adminAuth.verifyMasterAdminToken('rad_adm.only-one-part')).toEqual({ valid: false });
      expect(adminAuth.verifyMasterAdminToken('rad_adm.part1.part2.part3')).toEqual({ valid: false });
      expect(adminAuth.verifyMasterAdminToken('rad_adm.invalid-base64-json.sig')).toEqual({ valid: false });
    });
  });
});
