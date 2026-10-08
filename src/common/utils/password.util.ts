import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const SALT_SIZE = 16;
const KEY_SIZE = 32;
const ITERATIONS = 10000;

export interface PasswordCheck {
  ok: boolean;
  needsUpgrade: boolean;
}

export function hashPassword(password: string): string {
  if (!password) return '';
  const salt = randomBytes(SALT_SIZE);
  const key = pbkdf2Sync(password, salt, ITERATIONS, KEY_SIZE, 'sha1');
  return `PBKDF2$${ITERATIONS}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password: string, hash: string): PasswordCheck {
  if (!password || !hash) return { ok: false, needsUpgrade: false };
  if (hash.startsWith('PBKDF2$')) {
    const parts = hash.split('$');
    if (parts.length !== 4) return { ok: false, needsUpgrade: false };
    try {
      const iterations = parseInt(parts[1], 10);
      const salt = Buffer.from(parts[2], 'base64');
      const key = Buffer.from(parts[3], 'base64');
      const testKey = pbkdf2Sync(password, salt, iterations, key.length, 'sha1');
      return { ok: slowEquals(key, testKey), needsUpgrade: false };
    } catch {
      return { ok: false, needsUpgrade: false };
    }
  }
  const legacy = createHash('sha256').update(password, 'utf8').digest('base64');
  const match = legacy === hash;
  return { ok: match, needsUpgrade: match };
}

function slowEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
