import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const NAME_RE = /^[A-Za-z0-9 _.\-()]+\.json$/i;
const BACKUP_DIR = '.ekmek-backups';
const MAX_BACKUPS = 15;
const MAX_PARSE_BYTES = 4 * 1024 * 1024;
const MAX_SEARCH_BYTES = 32 * 1024 * 1024;
const MAX_QUERY_LEN = 200;

export interface FileEntry {
  name: string;
  size: number;
  modified: number;
  valid: boolean;
  keys: number;
}

export interface BackupEntry {
  stamp: string;
  size: number;
  created: number;
}

export interface SearchHit {
  name: string;
  line: number;
  text: string;
}

export class FileManager {
  readonly dir: string;

  constructor(dataDir: string) {
    this.dir = path.resolve(dataDir);
  }

  async ensureDir(): Promise<void> {
    if (!fs.existsSync(this.dir)) await fsp.mkdir(this.dir, { recursive: true });
  }

  validName(name: string): boolean {
    if (!name || name.includes('/') || name.includes(String.fromCharCode(92)) || name.includes('..')) return false;
    return NAME_RE.test(name);
  }

  private resolve(name: string): string | null {
    if (!this.validName(name)) return null;
    const full = path.join(this.dir, name);
    if (path.dirname(path.resolve(full)) !== this.dir) return null;
    return full;
  }

  private countKeys(raw: string): number {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return Object.keys(parsed).length;
      if (Array.isArray(parsed)) return parsed.length;
      return 0;
    } catch {
      return 0;
    }
  }

  async list(): Promise<FileEntry[]> {
    await this.ensureDir();
    const names = (await fsp.readdir(this.dir)).filter((n) => n.toLowerCase().endsWith('.json'));
    const out: FileEntry[] = [];
    for (const name of names) {
      const full = path.join(this.dir, name);
      try {
        const stat = await fsp.stat(full);
        if (!stat.isFile()) continue;
        if (stat.size > MAX_PARSE_BYTES) {
          out.push({ name, size: stat.size, modified: stat.mtimeMs, valid: true, keys: 0 });
          continue;
        }
        const raw = await fsp.readFile(full, 'utf-8');
        let valid = true;
        try { JSON.parse(raw); } catch { valid = false; }
        out.push({ name, size: stat.size, modified: stat.mtimeMs, valid, keys: valid ? this.countKeys(raw) : 0 });
      } catch {
        continue;
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  async read(name: string): Promise<string | null> {
    const full = this.resolve(name);
    if (!full || !fs.existsSync(full)) return null;
    return fsp.readFile(full, 'utf-8');
  }

  private backupDirFor(name: string): string {
    return path.join(this.dir, BACKUP_DIR, name);
  }

  private async snapshot(name: string, full: string): Promise<void> {
    if (!fs.existsSync(full)) return;
    const dir = this.backupDirFor(name);
    await fsp.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fsp.copyFile(full, path.join(dir, `${stamp}.json`));
    const kept = (await fsp.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    for (const old of kept.slice(0, Math.max(0, kept.length - MAX_BACKUPS))) {
      await fsp.rm(path.join(dir, old)).catch(() => undefined);
    }
  }

  async backups(name: string): Promise<BackupEntry[]> {
    if (!this.validName(name)) return [];
    const dir = this.backupDirFor(name);
    if (!fs.existsSync(dir)) return [];
    const out: BackupEntry[] = [];
    for (const f of await fsp.readdir(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const stat = await fsp.stat(path.join(dir, f));
        out.push({ stamp: f.replace(/\.json$/, ''), size: stat.size, created: stat.mtimeMs });
      } catch {
        continue;
      }
    }
    out.sort((a, b) => b.created - a.created);
    return out;
  }

  async readBackup(name: string, stamp: string): Promise<string | null> {
    if (!this.validName(name) || !/^[A-Za-z0-9\-]+$/.test(stamp)) return null;
    const full = path.join(this.backupDirFor(name), `${stamp}.json`);
    if (path.dirname(path.resolve(full)) !== path.resolve(this.backupDirFor(name))) return null;
    if (!fs.existsSync(full)) return null;
    return fsp.readFile(full, 'utf-8');
  }

  async write(name: string, content: string): Promise<{ ok: boolean; error?: string }> {
    const full = this.resolve(name);
    if (!full) return { ok: false, error: 'invalid_name' };
    try {
      JSON.parse(content);
    } catch {
      return { ok: false, error: 'invalid_json' };
    }
    await this.ensureDir();
    await this.snapshot(name, full).catch(() => undefined);
    const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tmp, content, 'utf-8');
    await fsp.rename(tmp, full);
    return { ok: true };
  }

  async create(name: string): Promise<{ ok: boolean; error?: string }> {
    const full = this.resolve(name);
    if (!full) return { ok: false, error: 'invalid_name' };
    if (fs.existsSync(full)) return { ok: false, error: 'exists' };
    await this.ensureDir();
    await fsp.writeFile(full, '{}', 'utf-8');
    return { ok: true };
  }

  async rename(from: string, to: string): Promise<{ ok: boolean; error?: string }> {
    const src = this.resolve(from);
    const dst = this.resolve(to);
    if (!src || !dst) return { ok: false, error: 'invalid_name' };
    if (!fs.existsSync(src)) return { ok: false, error: 'not_found' };
    if (fs.existsSync(dst)) return { ok: false, error: 'exists' };
    await fsp.rename(src, dst);
    const oldBackups = this.backupDirFor(from);
    if (fs.existsSync(oldBackups)) {
      await fsp.rename(oldBackups, this.backupDirFor(to)).catch(() => undefined);
    }
    return { ok: true };
  }

  async duplicate(name: string): Promise<{ ok: boolean; error?: string; name?: string }> {
    const src = this.resolve(name);
    if (!src) return { ok: false, error: 'invalid_name' };
    if (!fs.existsSync(src)) return { ok: false, error: 'not_found' };
    const base = name.replace(/\.json$/i, '');
    for (let i = 1; i < 100; i++) {
      const candidate = `${base}-copy${i > 1 ? i : ''}.json`;
      const dst = this.resolve(candidate);
      if (dst && !fs.existsSync(dst)) {
        await fsp.copyFile(src, dst);
        return { ok: true, name: candidate };
      }
    }
    return { ok: false, error: 'exists' };
  }

  async remove(name: string): Promise<boolean> {
    const full = this.resolve(name);
    if (!full || !fs.existsSync(full)) return false;
    await fsp.rm(full);
    await fsp.rm(this.backupDirFor(name), { recursive: true, force: true }).catch(() => undefined);
    return true;
  }

  async search(query: string, limit = 100): Promise<SearchHit[]> {
    const q = query.trim().slice(0, MAX_QUERY_LEN).toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    let scanned = 0;
    for (const entry of await this.list()) {
      if (scanned + entry.size > MAX_SEARCH_BYTES) break;
      scanned += entry.size;
      const raw = await this.read(entry.name);
      if (raw === null) continue;
      const lines = raw.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          hits.push({ name: entry.name, line: i + 1, text: lines[i].trim().slice(0, 200) });
          if (hits.length >= limit) return hits;
        }
      }
    }
    return hits;
  }
}
