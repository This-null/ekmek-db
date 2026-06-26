import { IncomingMessage, ServerResponse } from 'http';
import { EkmekDB } from '../../core/EkmekDB';
import { ConfigStore, SecuritySettings } from './config';
import { SessionManager, hashPassword, verifyPassword } from './auth';
import { LoginThrottle } from './security';
import { readJsonBody, sendJson, setSessionCookie, clearSessionCookie } from './http';

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  pathname: string;
  ip: string;
  token?: string;
  username: string | null;
}

interface ApiDeps {
  store: ConfigStore;
  db: EkmekDB;
  sessions: SessionManager;
  throttle: LoginThrottle;
  appVersion: string;
  dbName: string;
  rebind: (port: number, host: string) => Promise<void>;
}

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;

export class Api {
  constructor(private deps: ApiDeps) {}

  async handle(ctx: RequestContext): Promise<boolean> {
    if (!ctx.pathname.startsWith('/api/')) return false;
    const { res } = ctx;
    const route = `${ctx.method} ${ctx.pathname}`;

    try {
      switch (route) {
        case 'GET /api/status':
          return this.status(ctx);
        case 'POST /api/setup':
          return await this.setup(ctx);
        case 'POST /api/login':
          return await this.login(ctx);
        case 'POST /api/logout':
          return this.logout(ctx);
      }

      if (!ctx.username) {
        sendJson(res, 401, { error: 'unauthorized' });
        return true;
      }

      switch (route) {
        case 'GET /api/me':
          return this.me(ctx);
        case 'GET /api/data':
          return await this.getData(ctx);
        case 'POST /api/data':
          return await this.setData(ctx);
        case 'POST /api/data/delete':
          return await this.deleteData(ctx);
        case 'POST /api/data/clear':
          return await this.clearData(ctx);
        case 'GET /api/settings':
          return this.getSettings(ctx);
        case 'POST /api/settings':
          return await this.updateSettings(ctx);
        case 'POST /api/password':
          return await this.changePassword(ctx);
        case 'GET /api/export':
          return await this.exportData(ctx);
        case 'POST /api/import':
          return await this.importData(ctx);
        default:
          sendJson(res, 404, { error: 'not_found' });
          return true;
      }
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message || 'bad_request' });
      return true;
    }
  }

  private get cfg() {
    return this.deps.store.get();
  }

  private guardReadOnly(res: ServerResponse): boolean {
    if (this.cfg.security.readOnly) {
      sendJson(res, 403, { error: 'read_only' });
      return false;
    }
    return true;
  }

  private status(ctx: RequestContext): boolean {
    const c = this.cfg;
    sendJson(ctx.res, 200, {
      setup: c.setup,
      authed: Boolean(ctx.username),
      name: this.deps.dbName,
      version: this.deps.appVersion,
      theme: c.theme,
      language: c.language,
    });
    return true;
  }

  private async setup(ctx: RequestContext): Promise<boolean> {
    if (this.cfg.setup) {
      sendJson(ctx.res, 409, { error: 'already_setup' });
      return true;
    }
    const body = await readJsonBody(ctx.req);
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    if (!USERNAME_RE.test(username)) {
      sendJson(ctx.res, 400, { error: 'invalid_username' });
      return true;
    }
    if (password.length < 8) {
      sendJson(ctx.res, 400, { error: 'weak_password' });
      return true;
    }
    const { salt, hash } = hashPassword(password);
    await this.deps.store.update({ setup: true, admin: { username, salt, hash } });
    const token = this.deps.sessions.create(username);
    setSessionCookie(ctx.res, token, this.cfg.security.sessionTtlMs);
    sendJson(ctx.res, 201, { ok: true, username });
    return true;
  }

  private async login(ctx: RequestContext): Promise<boolean> {
    const lockedMs = this.deps.throttle.lockedFor(ctx.ip);
    if (lockedMs > 0) {
      sendJson(ctx.res, 429, { error: 'locked', retryInMs: lockedMs });
      return true;
    }
    const body = await readJsonBody(ctx.req);
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const admin = this.cfg.admin;

    if (!admin || admin.username !== username || !verifyPassword(password, admin)) {
      this.deps.throttle.recordFailure(ctx.ip);
      sendJson(ctx.res, 401, { error: 'invalid_credentials' });
      return true;
    }

    this.deps.throttle.reset(ctx.ip);
    const token = this.deps.sessions.create(username);
    setSessionCookie(ctx.res, token, this.cfg.security.sessionTtlMs);
    sendJson(ctx.res, 200, { ok: true, username });
    return true;
  }

  private logout(ctx: RequestContext): boolean {
    this.deps.sessions.destroy(ctx.token);
    clearSessionCookie(ctx.res);
    sendJson(ctx.res, 200, { ok: true });
    return true;
  }

  private me(ctx: RequestContext): boolean {
    sendJson(ctx.res, 200, {
      username: ctx.username,
      readOnly: this.cfg.security.readOnly,
    });
    return true;
  }

  private async getData(ctx: RequestContext): Promise<boolean> {
    const all = await this.deps.db.all();
    const entries = Object.entries(all).map(([key, value]) => ({
      key,
      value,
      type: Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value,
    }));
    sendJson(ctx.res, 200, { entries, size: entries.length });
    return true;
  }

  private async setData(ctx: RequestContext): Promise<boolean> {
    if (!this.guardReadOnly(ctx.res)) return true;
    const body = await readJsonBody(ctx.req);
    const key = String(body.key ?? '').trim();
    if (!key) {
      sendJson(ctx.res, 400, { error: 'invalid_key' });
      return true;
    }
    await this.deps.db.set(key, body.value);
    sendJson(ctx.res, 200, { ok: true, key });
    return true;
  }

  private async deleteData(ctx: RequestContext): Promise<boolean> {
    if (!this.guardReadOnly(ctx.res)) return true;
    const body = await readJsonBody(ctx.req);
    const key = String(body.key ?? '').trim();
    const removed = await this.deps.db.delete(key);
    sendJson(ctx.res, 200, { ok: true, removed });
    return true;
  }

  private async clearData(ctx: RequestContext): Promise<boolean> {
    if (!this.guardReadOnly(ctx.res)) return true;
    await this.deps.db.clear();
    sendJson(ctx.res, 200, { ok: true });
    return true;
  }

  private getSettings(ctx: RequestContext): boolean {
    const c = this.cfg;
    sendJson(ctx.res, 200, {
      port: c.port,
      host: c.host,
      theme: c.theme,
      language: c.language,
      security: c.security,
      configPath: this.deps.store.filePath,
    });
    return true;
  }

  private async updateSettings(ctx: RequestContext): Promise<boolean> {
    const body = await readJsonBody(ctx.req);
    const patch: any = {};

    if (body.theme === 'dark' || body.theme === 'light') patch.theme = body.theme;
    if (body.language === 'en' || body.language === 'tr') patch.language = body.language;

    let portChanged = false;
    let nextPort = this.cfg.port;
    let nextHost = this.cfg.host;

    if (body.port !== undefined) {
      const p = Number(body.port);
      if (!Number.isInteger(p) || p < 1 || p > 65535) {
        sendJson(ctx.res, 400, { error: 'invalid_port' });
        return true;
      }
      if (p !== this.cfg.port) {
        patch.port = p;
        nextPort = p;
        portChanged = true;
      }
    }
    if (typeof body.host === 'string' && body.host.trim() && body.host !== this.cfg.host) {
      patch.host = body.host.trim();
      nextHost = patch.host;
      portChanged = true;
    }

    if (body.security && typeof body.security === 'object') {
      patch.security = this.sanitizeSecurity(body.security);
    }

    const updated = await this.deps.store.update(patch);
    this.deps.throttle.update(updated.security);
    this.deps.sessions.setTtl(updated.security.sessionTtlMs);

    if (portChanged) {
      sendJson(ctx.res, 200, { ok: true, restarted: true, port: nextPort, host: nextHost });
      setImmediate(() => {
        this.deps.rebind(nextPort, nextHost).catch(() => undefined);
      });
      return true;
    }

    sendJson(ctx.res, 200, { ok: true, restarted: false });
    return true;
  }

  private sanitizeSecurity(input: any): Partial<SecuritySettings> {
    const out: Partial<SecuritySettings> = {};
    const ipList = (v: any): string[] =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
    if ('allowlist' in input) out.allowlist = ipList(input.allowlist);
    if ('blocklist' in input) out.blocklist = ipList(input.blocklist);
    if ('readOnly' in input) out.readOnly = Boolean(input.readOnly);
    const num = (v: any, min: number, max: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : undefined;
    };
    const ma = num(input.maxLoginAttempts, 1, 100);
    if (ma !== undefined) out.maxLoginAttempts = ma;
    const lw = num(input.loginWindowMs, 1000, 24 * 60 * 60 * 1000);
    if (lw !== undefined) out.loginWindowMs = lw;
    const lo = num(input.lockoutMs, 1000, 24 * 60 * 60 * 1000);
    if (lo !== undefined) out.lockoutMs = lo;
    const st = num(input.sessionTtlMs, 60 * 1000, 30 * 24 * 60 * 60 * 1000);
    if (st !== undefined) out.sessionTtlMs = st;
    return out;
  }

  private async changePassword(ctx: RequestContext): Promise<boolean> {
    const body = await readJsonBody(ctx.req);
    const current = String(body.current ?? '');
    const next = String(body.next ?? '');
    const admin = this.cfg.admin;
    if (!admin || !verifyPassword(current, admin)) {
      sendJson(ctx.res, 401, { error: 'invalid_credentials' });
      return true;
    }
    if (next.length < 8) {
      sendJson(ctx.res, 400, { error: 'weak_password' });
      return true;
    }
    const { salt, hash } = hashPassword(next);
    await this.deps.store.update({ admin: { username: admin.username, salt, hash } });
    this.deps.sessions.destroyAll();
    clearSessionCookie(ctx.res);
    sendJson(ctx.res, 200, { ok: true });
    return true;
  }

  private async exportData(ctx: RequestContext): Promise<boolean> {
    const all = await this.deps.db.all();
    const filename = `${this.deps.dbName}-export-${new Date().toISOString().slice(0, 10)}.json`;
    ctx.res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    ctx.res.end(JSON.stringify(all, null, 2));
    return true;
  }

  private async importData(ctx: RequestContext): Promise<boolean> {
    if (!this.guardReadOnly(ctx.res)) return true;
    const body = await readJsonBody(ctx.req);
    const data = body.data;
    const mode = body.mode === 'replace' ? 'replace' : 'merge';
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      sendJson(ctx.res, 400, { error: 'invalid_data' });
      return true;
    }
    if (mode === 'replace') {
      await this.deps.db.clear();
    }
    let count = 0;
    for (const [key, value] of Object.entries(data)) {
      await this.deps.db.set(key, value);
      count += 1;
    }
    sendJson(ctx.res, 200, { ok: true, imported: count, mode });
    return true;
  }
}
