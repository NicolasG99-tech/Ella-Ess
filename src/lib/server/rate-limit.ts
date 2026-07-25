import { db } from '@/lib/server/db';

// Zentraler, DB-gestützter Rate-Limiter (fixed window) über die
// `RateLimitBucket`-Tabelle (siehe prisma/schema.prisma). Ersetzt die
// frühere reine In-Memory-Implementierung, die pro Node-Prozess lief, keinen
// Neustart überlebte und bei mehreren Instanzen nicht griff (siehe
// docs/SECURITY.md, "Bekannte Einschränkungen" — dieser Punkt ist damit
// erledigt).
//
// Bewusst über Postgres/Prisma statt Redis: keine zusätzliche
// Infrastruktur-Abhängigkeit nötig, nutzt die ohnehin vorhandene Datenbank.
// Trade-off gegenüber Redis: es gibt ein kleines Race-Window zwischen Lesen
// und Schreiben bei sehr vielen gleichzeitigen Anfragen für denselben
// Schlüssel — für Rate-Limiting (kein hartes Sicherheitsversprechen, sondern
// eine zusätzliche Bremse neben Argon2id) akzeptabel, siehe
// security-red-team-Agent. Bei deutlich höherem Anfragevolumen als im MVP zu
// erwarten: auf Redis migrieren.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = new Date();
  const existing = await db.rateLimitBucket.findUnique({ where: { key } });

  const windowExpired = !existing || now.getTime() - existing.windowStart.getTime() >= windowMs;

  if (windowExpired) {
    await db.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  await db.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return true;
}
