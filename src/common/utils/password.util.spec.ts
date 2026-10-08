import { createHash } from 'crypto';
import { hashPassword, verifyPassword } from './password.util';

describe('password', () => {
  it('verifies PBKDF2-SHA1 hashes compatible with ASP.NET Rfc2898DeriveBytes', () => {
    const hash = hashPassword('Secret123');
    expect(hash.startsWith('PBKDF2$10000$')).toBe(true);
    expect(verifyPassword('Secret123', hash)).toEqual({ ok: true, needsUpgrade: false });
    expect(verifyPassword('nope', hash).ok).toBe(false);
  });

  it('accepts legacy unsalted SHA-256 and flags an upgrade', () => {
    const legacy = createHash('sha256').update('Secret123', 'utf8').digest('base64');
    expect(verifyPassword('Secret123', legacy)).toEqual({ ok: true, needsUpgrade: true });
  });

  it('rejects empty and malformed hashes', () => {
    expect(verifyPassword('', 'x').ok).toBe(false);
    expect(verifyPassword('a', 'PBKDF2$bad').ok).toBe(false);
    expect(hashPassword('')).toBe('');
  });
});
