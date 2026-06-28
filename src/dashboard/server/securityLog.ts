import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'login_locked'
  | 'setup'
  | 'logout'
  | 'password_changed'
  | 'ip_blocked'
  | 'honeypot'
  | 'csrf_failed'
  | 'settings_changed'
  | 'data_changed'
  | 'import';

export interface SecurityEvent {
  ts: number;
  type: SecurityEventType;
  ip: string;
  ua: string;
  path: string;
  detail?: string;
}

export class SecurityLog {
  private events: SecurityEvent[] = [];
  private readonly cap: number;
  private readonly filePath: string;
  private dirty = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(filePath: string, cap = 300) {
    this.filePath = filePath;
    this.cap = cap;
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const arr = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (Array.isArray(arr)) this.events = arr.slice(-this.cap);
      }
    } catch {
      this.events = [];
    }
  }

  record(ev: { type: SecurityEventType; ip: string; ua: string; path: string; detail?: string }): void {
    this.events.push({
      ts: Date.now(),
      type: ev.type,
      ip: ev.ip,
      ua: (ev.ua || '').slice(0, 256),
      path: (ev.path || '').slice(0, 256),
      detail: ev.detail ? ev.detail.slice(0, 256) : undefined,
    });
    if (this.events.length > this.cap) this.events = this.events.slice(-this.cap);
    this.scheduleFlush();
  }

  list(limit = 150): SecurityEvent[] {
    return this.events.slice(-limit).reverse();
  }

  clear(): void {
    this.events = [];
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.flush().catch(() => undefined);
    }, 3000);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  async flush(): Promise<void> {
    this.timer = null;
    if (!this.dirty) return;
    this.dirty = false;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) await fsp.mkdir(dir, { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(this.events), 'utf-8');
      await fsp.rename(tmp, this.filePath);
    } catch {
      this.dirty = true;
    }
  }
}
