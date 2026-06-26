import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface AdminUser {
  username: string;
  salt: string;
  hash: string;
}

export interface SecuritySettings {
  allowlist: string[];
  blocklist: string[];
  maxLoginAttempts: number;
  loginWindowMs: number;
  lockoutMs: number;
  readOnly: boolean;
  sessionTtlMs: number;
}

export interface DashboardConfig {
  setup: boolean;
  admin: AdminUser | null;
  port: number;
  host: string;
  theme: 'dark' | 'light';
  language: 'en' | 'tr';
  security: SecuritySettings;
  secret: string;
}

export function defaultConfig(): DashboardConfig {
  return {
    setup: false,
    admin: null,
    port: 8080,
    host: '0.0.0.0',
    theme: 'dark',
    language: 'en',
    security: {
      allowlist: [],
      blocklist: [],
      maxLoginAttempts: 5,
      loginWindowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      readOnly: false,
      sessionTtlMs: 12 * 60 * 60 * 1000,
    },
    secret: crypto.randomBytes(48).toString('hex'),
  };
}

export class ConfigStore {
  readonly filePath: string;
  private config: DashboardConfig;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.config = this.load();
  }

  private load(): DashboardConfig {
    if (!fs.existsSync(this.filePath)) {
      return defaultConfig();
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const base = defaultConfig();
      return {
        ...base,
        ...parsed,
        security: { ...base.security, ...(parsed.security ?? {}) },
        secret: parsed.secret || base.secret,
      };
    } catch {
      return defaultConfig();
    }
  }

  get(): DashboardConfig {
    return this.config;
  }

  async update(patch: Partial<DashboardConfig>): Promise<DashboardConfig> {
    this.config = {
      ...this.config,
      ...patch,
      security: { ...this.config.security, ...(patch.security ?? {}) },
    };
    await this.save();
    return this.config;
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      await fsp.mkdir(dir, { recursive: true });
    }
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(this.config, null, 2), { encoding: 'utf-8', mode: 0o600 });
    await fsp.rename(tmp, this.filePath);
  }
}
