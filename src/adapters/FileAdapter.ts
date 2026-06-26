import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import _ from 'lodash';
import { BaseAdapter } from './BaseAdapter';
import { Mutex } from '../utils/Mutex';

export interface FileAdapterOptions {
  folder?: string;
  file?: string;
}

export abstract class FileAdapter implements BaseAdapter {
  protected readonly filePath: string;
  private readonly emptyContent: string;
  private readonly mutex = new Mutex();
  private readonly ready: Promise<void>;

  constructor(filePath: string, emptyContent: string) {
    this.filePath = filePath;
    this.emptyContent = emptyContent;
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
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf-8');
    } catch (err: any) {
      if (err && err.code === 'ENOENT') {
        await this.init();
        return {};
      }
      throw err;
    }

    if (raw.trim() === '') return {};

    try {
      return this.deserialize(raw) ?? {};
    } catch (err) {
      throw new Error(
        `[ekmek-db] Failed to parse database file at "${this.filePath}": ${(err as Error).message}`
      );
    }
  }

  private async write(data: Record<string, any>): Promise<void> {
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, this.serialize(data), 'utf-8');
    await fs.rename(tmp, this.filePath);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.read();
    return _.get(data, key, null) as T | null;
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
    return this.read();
  }

  async clear(): Promise<void> {
    await this.mutex.run(() => this.write({}));
  }
}
