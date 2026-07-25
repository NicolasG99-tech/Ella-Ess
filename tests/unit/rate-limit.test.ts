import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from '@/lib/server/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('erlaubt Versuche bis zum Limit', () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
  });

  it('blockiert Versuche über dem Limit innerhalb des Zeitfensters', () => {
    const key = `test:${Math.random()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    expect(checkRateLimit(key, 2, 60_000)).toBe(false);
  });

  it('erlaubt wieder Versuche, nachdem das Zeitfenster verstrichen ist', () => {
    const key = `test:${Math.random()}`;
    checkRateLimit(key, 1, 60_000);
    expect(checkRateLimit(key, 1, 60_000)).toBe(false);

    vi.advanceTimersByTime(61_000);

    expect(checkRateLimit(key, 1, 60_000)).toBe(true);
  });

  it('zählt verschiedene Schlüssel unabhängig voneinander', () => {
    const keyA = `test:a:${Math.random()}`;
    const keyB = `test:b:${Math.random()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000)).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000)).toBe(true);
  });
});
