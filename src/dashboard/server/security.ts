import { IncomingMessage, ServerResponse } from 'http';
import { SecuritySettings } from './config';

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

const HONEYPOT_PATHS = [
  '/wp-login.php',
  '/wp-admin',
  '/wp-content',
  '/xmlrpc.php',
  '/.env',
  '/.git',
  '/.git/config',
  '/phpmyadmin',
  '/pma',
  '/admin.php',
  '/administrator',
  '/.aws',
  '/.ssh',
  '/config.php',
  '/shell',
  '/vendor/phpunit',
  '/solr',
  '/actuator',
  '/owa',
  '/.vscode',
  '/cgi-bin',
];

export function clientIp(req: IncomingMessage): string {
  let ip = req.socket.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

export function isLoopback(ip: string): boolean {
  return LOOPBACK.has(ip);
}

export function isIpAllowed(ip: string, security: SecuritySettings): boolean {
  if (isLoopback(ip)) return true;
  if (security.blocklist.includes(ip)) return false;
  if (security.allowlist.length > 0 && !security.allowlist.includes(ip)) return false;
  return true;
}

export function isHoneypotPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return HONEYPOT_PATHS.some((h) => p === h || p.startsWith(h + '/') || p.startsWith(h + '?'));
}

interface Attempt {
  count: number;
  first: number;
  lockedUntil: number;
}

export class LoginThrottle {
  private attempts = new Map<string, Attempt>();

  constructor(private security: SecuritySettings) {}

  update(security: SecuritySettings): void {
    this.security = security;
  }

  lockedFor(ip: string): number {
    const a = this.attempts.get(ip);
    if (!a) return 0;
    if (a.lockedUntil > Date.now()) return a.lockedUntil - Date.now();
    return 0;
  }

  recordFailure(ip: string): void {
    const now = Date.now();
    const a = this.attempts.get(ip) ?? { count: 0, first: now, lockedUntil: 0 };
    if (now - a.first > this.security.loginWindowMs) {
      a.count = 0;
      a.first = now;
    }
    a.count += 1;
    if (a.count >= this.security.maxLoginAttempts) {
      a.lockedUntil = now + this.security.lockoutMs;
    }
    this.attempts.set(ip, a);
  }

  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
}
