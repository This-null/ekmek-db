import fs from 'fs/promises';
import fsSync, { existsSync } from 'fs';
import path from 'path';
import _ from 'lodash';
import { BaseAdapter } from './BaseAdapter';
import { Mutex } from '../utils/Mutex';

export interface FileAdapterOptions {
  folder?: string;
  file?: string;
  cache?: boolean;
}

export abstract class FileAdapter implements BaseAdapter {
  protected readonly filePath: string;
  private readonly emptyContent: string;
  private readonly mutex = new Mutex();
  private readonly ready: Promise<void>;
  private readonly cacheEnabled: boolean;
  private cached: Record<string, any> | null = null;
  private cachedMtimeMs = -1;
  private cachedSize = -1;

  constructor(filePath: string, emptyContent: string, cache = true) {
    this.filePath = filePath;
    this.emptyContent = emptyContent;
    this.cacheEnabled = cache;
    this.ready = this.init();
  }

  protected abstract serialize(data: Record<string, any>): string;
  protected abstract deserialize(raw: string): Record<string, any>;

  private async init(): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    if (!existsSync(this.filePath)) {
      await fs.writeFile(this.filePath, this.emptyContent, 'utf-8');
    }
  }

  private async read(): Promise<Record<string, any>> {
    await this.ready;

    if (this.cacheEnabled && this.cached !== null) {
      try {
        const stat = await fs.stat(this.filePath);
        if (stat.mtimeMs === this.cachedMtimeMs && stat.size === this.cachedSize) {
          return this.cached;
        }
      } catch {
        this.invalidate();
      }
    }

    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf-8');
    } catch (err: any) {
      if (err && err.code === 'ENOENT') {
        await this.init();
        this.invalidate();
        return {};
      }
      throw err;
    }

    if (raw.trim() === '') return this.remember({});

    try {
      return this.remember(this.deserialize(raw) ?? {});
    } catch (err) {
      throw new Error(
        `[ekmek-db] Failed to parse database file at "${this.filePath}": ${(err as Error).message}`
      );
    }
  }

  private remember(data: Record<string, any>): Record<string, any> {
    if (!this.cacheEnabled) return data;
    try {
      const stat = fsSync.statSync(this.filePath);
      this.cached = data;
      this.cachedMtimeMs = stat.mtimeMs;
      this.cachedSize = stat.size;
    } catch {
      this.invalidate();
    }
    return data;
  }

  private detach<T>(value: T): T {
    if (!this.cacheEnabled || value === null || typeof value !== 'object') return value;
    return _.cloneDeep(value);
  }

  protected invalidate(): void {
    this.cached = null;
    this.cachedMtimeMs = -1;
    this.cachedSize = -1;
  }

  private async write(data: Record<string, any>): Promise<void> {
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, this.serialize(data), 'utf-8');
    await fs.rename(tmp, this.filePath);
    if (this.cacheEnabled) {
      this.cached = data;
      try {
        const stat = await fs.stat(this.filePath);
        this.cachedMtimeMs = stat.mtimeMs;
        this.cachedSize = stat.size;
      } catch {
        this.invalidate();
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.read();
    return this.detach(_.get(data, key, null)) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.mutex.run(async () => {
      const data = await this.read();
      _.set(data, key, value);
      await this.write(data);
    });
  }

  async has(key: string): Promise<boolean> {
    const data = await this.read();
    return _.has(data, key);
  }

  async delete(key: string): Promise<boolean> {
    return this.mutex.run(async () => {
      const data = await this.read();
      const result = _.has(data, key);
      if (result) {
        _.unset(data, key);
        await this.write(data);
      }
      return result;
    });
  }

  async all(): Promise<Record<string, any>> {
    return this.detach(await this.read());
  }

  async clear(): Promise<void> {
    await this.mutex.run(() => this.write({}));
  }
}
