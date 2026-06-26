import http, { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { EkmekDB } from '../../core/EkmekDB';
import { ConfigStore } from './config';
import { SessionManager, parseCookies } from './auth';
import { LoginThrottle, clientIp, isIpAllowed, applySecurityHeaders } from './security';
import { Api, RequestContext } from './api';
import { sendJson, sendText } from './http';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface DashboardServerDeps {
  store: ConfigStore;
  db: EkmekDB;
  appVersion: string;
  dbName: string;
  publicDir: string;
  quiet?: boolean;
}

export class DashboardServer {
  private server: http.Server | null = null;
  private sessions: SessionManager;
  private throttle: LoginThrottle;
  private api: Api;
  private currentPort: number;
  private currentHost: string;

  constructor(private deps: DashboardServerDeps) {
    const cfg = deps.store.get();
    this.currentPort = cfg.port;
    this.currentHost = cfg.host;
    this.sessions = new SessionManager(cfg.security.sessionTtlMs);
    this.throttle = new LoginThrottle(cfg.security);
    this.api = new Api({
      store: deps.store,
      db: deps.db,
      sessions: this.sessions,
      throttle: this.throttle,
      appVersion: deps.appVersion,
      dbName: deps.dbName,
      rebind: (port, host) => this.rebind(port, host),
    });
  }

  async start(): Promise<void> {
    await this.listen(this.currentPort, this.currentHost);
    this.printBanner();
  }

  private listen(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => this.onRequest(req, res));
      server.on('error', reject);
      server.listen(port, host, () => {
        this.server = server;
        this.currentPort = port;
        this.currentHost = host;
        server.removeListener('error', reject);
        resolve();
      });
    });
  }

  private async rebind(port: number, host: string): Promise<void> {
    await this.stop();
    try {
      await this.listen(port, host);
      this.printBanner('rebind');
    } catch (err) {
      await this.listen(this.deps.store.get().port, this.deps.store.get().host).catch(() => undefined);
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  private async onRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    applySecurityHeaders(res);
    const cfg = this.deps.store.get();
    const ip = clientIp(req);

    if (!isIpAllowed(ip, cfg.security)) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['ekmek_sid'];
    const username = this.sessions.verify(token);

    const ctx: RequestContext = {
      req,
      res,
      method: req.method || 'GET',
      pathname,
      ip,
      token,
      username,
    };

    if (pathname.startsWith('/api/')) {
      const handled = await this.api.handle(ctx);
      if (!handled) sendJson(res, 404, { error: 'not_found' });
      return;
    }

    await this.serveStatic(pathname, res);
  }

  private async serveStatic(pathname: string, res: ServerResponse): Promise<void> {
    const root = this.deps.publicDir;
    let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.join(root, rel);
    if (!filePath.startsWith(path.resolve(root))) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    try {
      const stat = await fsp.stat(filePath).catch(() => null);
      if (stat && stat.isFile()) {
        return this.streamFile(filePath, res);
      }
      if (!path.extname(rel)) {
        return this.streamFile(path.join(root, 'index.html'), res);
      }
      sendText(res, 404, 'Not Found');
    } catch {
      sendText(res, 500, 'Internal Server Error');
    }
  }

  private streamFile(filePath: string, res: ServerResponse): void {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  }

  private lanAddresses(): string[] {
    const out: string[] = [];
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const net of ifaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) out.push(net.address);
      }
    }
    return out;
  }

  private printBanner(kind: 'start' | 'rebind' = 'start'): void {
    if (this.deps.quiet) return;
    const port = this.currentPort;
    const lines: string[] = [];
    lines.push('');
    lines.push('  🍞  ekmek-db dashboard active');
    lines.push(`      Local:    http://localhost:${port}`);
    for (const ip of this.lanAddresses()) {
      lines.push(`      Network:  http://${ip}:${port}`);
    }
    if (kind === 'rebind') lines.push('      (re-bound to new port)');
    lines.push('');
    console.log(lines.join('\n'));
  }
}

export function resolvePublicDir(): string {
  return path.join(__dirname, '..', 'public');
}
