import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

const NAME_RE = /^[A-Za-z0-9 _.\-()]+\.json$/i;

export interface FileEntry {
  name: string;
  size: number;
  modified: number;
  valid: boolean;
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
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false;
    return NAME_RE.test(name);
  }

  private resolve(name: string): string | null {
    if (!this.validName(name)) return null;
    const full = path.join(this.dir, name);
    if (path.dirname(path.resolve(full)) !== this.dir) return null;
    return full;
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
        let valid = true;
        try {
          JSON.parse(await fsp.readFile(full, 'utf-8'));
        } catch {
          valid = false;
        }
        out.push({ name, size: stat.size, modified: stat.mtimeMs, valid });
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

  async write(name: string, content: string): Promise<{ ok: boolean; error?: string }> {
    const full = this.resolve(name);
    if (!full) return { ok: false, error: 'invalid_name' };
    try {
      JSON.parse(content);
    } catch {
      return { ok: false, error: 'invalid_json' };
    }
    await this.ensureDir();
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

  async remove(name: string): Promise<boolean> {
    const full = this.resolve(name);
    if (!full || !fs.existsSync(full)) return false;
    await fsp.rm(full);
    return true;
  }
}
