import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from '@/lib/server/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // checkRateLimit ist seit der Umstellung auf den Postgres-gestützten
  // Fixed-Window-Limiter (siehe rate-limit.ts) async und liefert ein
  // Promise<boolean>. Die ursprünglichen Tests riefen die Funktion ohne
  // `await` auf und verglichen damit faktisch ein Promise-Objekt statt des
  // aufgelösten booleschen Werts mit `toBe(true/false)` — das ist technisch
  // immer falsch (ein Promise ist nie `=== true`), fiel aber offenbar nicht
  // auf, weil diese unit-Tests eine echte DB-Verbindung voraussetzen und
  // daher nur bei lokal laufendem Postgres ausgeführt werden. Fix: alle
  // it()-Callbacks async, jeder Aufruf mit await.
  it('erlaubt Versuche bis zum Limit', async () => {
    const key = `test:${Math.random()}`;
    expect(await checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(key, 3, 60_000)).toBe(true);
  });

  it('blockiert Versuche über dem Limit innerhalb des Zeitfensters', async () => {
    const key = `test:${Math.random()}`;
    await checkRateLimit(key, 2, 60_000);
    await checkRateLimit(key, 2, 60_000);
    expect(await checkRateLimit(key, 2, 60_000)).toBe(false);
  });

  it('erlaubt wieder Versuche, nachdem das Zeitfenster verstrichen ist', async () => {
    const key = `test:${Math.random()}`;
    await checkRateLimit(key, 1, 60_000);
    expect(await checkRateLimit(key, 1, 60_000)).toBe(false);

    vi.advanceTimersByTime(61_000);

    expect(await checkRateLimit(key, 1, 60_000)).toBe(true);
  });

  it('zählt verschiedene Schlüssel unabhängig voneinander', async () => {
    const keyA = `test:a:${Math.random()}`;
    const keyB = `test:b:${Math.random()}`;
    await checkRateLimit(keyA, 1, 60_000);
    expect(await checkRateLimit(keyA, 1, 60_000)).toBe(false);
    expect(await checkRateLimit(keyB, 1, 60_000)).toBe(true);
  });
});
