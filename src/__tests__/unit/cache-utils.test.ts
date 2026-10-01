import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryCache } from '@/lib/cache-utils';

describe('queryCache', () => {
  beforeEach(() => {
    queryCache.clear();
  });

  it('should store and retrieve a value', () => {
    // Arrange
    const key = 'test-key';
    const value = { data: 'test-value' };

    // Act
    queryCache.set(key, value);
    const result = queryCache.get(key);

    // Assert
    expect(result).toEqual(value);
  });

  it('should return null for non-existent key', () => {
    const result = queryCache.get('non-existent-key');
    expect(result).toBeNull();
  });

  it('should return null for expired entries', () => {
    vi.useFakeTimers();
    try {
      // Arrange
      queryCache.set('expiring-key', 'value', 1); // 1 second TTL

      // Act - advance time past TTL
      vi.advanceTimersByTime(1500);

      // Assert
      const result = queryCache.get('expiring-key');
      expect(result).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should return value before TTL expires', () => {
    vi.useFakeTimers();
    try {
      // Arrange
      queryCache.set('valid-key', 'value', 10);

      // Act - advance time but not past TTL
      vi.advanceTimersByTime(5000);

      // Assert
      const result = queryCache.get('valid-key');
      expect(result).toBe('value');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should use default TTL of 30 seconds', () => {
    vi.useFakeTimers();
    try {
      // Arrange
      queryCache.set('default-ttl', 'value');

      // Act - advance 29 seconds
      vi.advanceTimersByTime(29000);

      // Assert
      expect(queryCache.get('default-ttl')).toBe('value');

      // Act - advance past 30 seconds
      vi.advanceTimersByTime(2000);

      // Assert
      expect(queryCache.get('default-ttl')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should invalidate a specific key', () => {
    // Arrange
    queryCache.set('key1', 'value1');
    queryCache.set('key2', 'value2');

    // Act
    queryCache.invalidate('key1');

    // Assert
    expect(queryCache.get('key1')).toBeNull();
    expect(queryCache.get('key2')).toBe('value2');
  });

  it('should invalidate keys by prefix', () => {
    // Arrange
    queryCache.set('projects:1', 'proj1');
    queryCache.set('projects:2', 'proj2');
    queryCache.set('profile:1', 'profile1');

    // Act
    queryCache.invalidatePrefix('projects:');

    // Assert
    expect(queryCache.get('projects:1')).toBeNull();
    expect(queryCache.get('projects:2')).toBeNull();
    expect(queryCache.get('profile:1')).toBe('profile1');
  });

  it('should clear all entries', () => {
    // Arrange
    queryCache.set('key1', 'value1');
    queryCache.set('key2', 'value2');
    queryCache.set('key3', 'value3');

    // Act
    queryCache.clear();

    // Assert
    expect(queryCache.get('key1')).toBeNull();
    expect(queryCache.get('key2')).toBeNull();
    expect(queryCache.get('key3')).toBeNull();
  });

  it('should overwrite existing values', () => {
    // Arrange
    queryCache.set('key', 'original');

    // Act
    queryCache.set('key', 'updated');

    // Assert
    expect(queryCache.get('key')).toBe('updated');
  });

  it('should handle different data types', () => {
    // Arrange & Act
    queryCache.set('string-key', 'string-value');
    queryCache.set('number-key', 42);
    queryCache.set('array-key', [1, 2, 3]);
    queryCache.set('object-key', { nested: true });
    queryCache.set('null-key', null);
    queryCache.set('boolean-key', true);

    // Assert
    expect(queryCache.get('string-key')).toBe('string-value');
    expect(queryCache.get('number-key')).toBe(42);
    expect(queryCache.get('array-key')).toEqual([1, 2, 3]);
    expect(queryCache.get('object-key')).toEqual({ nested: true });
    expect(queryCache.get('null-key')).toBeNull();
    expect(queryCache.get('boolean-key')).toBe(true);
  });

  it('should handle zero TTL (immediate expiration)', () => {
    vi.useFakeTimers();
    try {
      // Arrange
      queryCache.set('zero-ttl', 'value', 0);

      // Act - any time advancement
      vi.advanceTimersByTime(1);

      // Assert
      expect(queryCache.get('zero-ttl')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should handle negative TTL', () => {
    vi.useFakeTimers();
    try {
      // Arrange
      queryCache.set('negative-ttl', 'value', -1);

      // Act
      vi.advanceTimersByTime(1);

      // Assert
      expect(queryCache.get('negative-ttl')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
