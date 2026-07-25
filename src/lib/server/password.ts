import { hash, verify } from '@node-rs/argon2';

// Parameter orientiert an der OWASP Password Storage Cheat Sheet-Empfehlung
// für Argon2id (mindestens 19 MiB Speicher, 2 Iterationen).
// `algorithm: 2` entspricht Algorithm.Argon2id — als Zahlenliteral statt Import
// des ambient `const enum`, das unter isolatedModules nicht referenzierbar ist.
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password, ARGON2_OPTIONS);
}
