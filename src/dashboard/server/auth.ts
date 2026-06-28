import crypto from 'crypto';
import { AdminUser } from './config';

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, user: AdminUser): boolean {
  const candidate = crypto.scryptSync(password, user.salt, 64);
  const expected = Buffer.from(user.hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

interface Session {
  username: string;
  expiresAt: number;
  csrf: string;
}

export interface SessionInfo {
  token: string;
  csrf: string;
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  constructor(private ttlMs: number) {}

  setTtl(ttlMs: number): void {
    this.ttlMs = ttlMs;
  }

  create(username: string): SessionInfo {
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');
    this.sessions.set(token, { username, expiresAt: Date.now() + this.ttlMs, csrf });
    return { token, csrf };
  }

  verify(token: string | undefined): string | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return session.username;
  }

  csrfFor(token: string | undefined): string | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) return null;
    return session.csrf;
  }

  destroy(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }

  destroyAll(): void {
    this.sessions.clear();
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}
