import { describe, it, expect } from 'vitest';

describe('Smoke Test', () => {
  it('test runner is working', () => {
    expect(true).toBe(true);
  });

  it('basic math works', () => {
    expect(1 + 1).toBe(2);
  });

  it('environment is jsdom', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });
});
