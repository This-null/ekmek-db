import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import _ from 'lodash';
import { BaseAdapter } from './BaseAdapter';

export class JsonAdapter implements BaseAdapter {
  private filePath: string;

  constructor(options: { folder?: string; file?: string } = {}) {
    const folder = options.folder || 'data';
    const file = options.file || 'db.json';
    this.filePath = path.join(process.cwd(), folder, file);
    this.init();
  }

  private async init(): Promise<void> {
    const dir = path.dirname(this.filePath);
    
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    if (!existsSync(this.filePath)) {
      await fs.writeFile(this.filePath, '{}', 'utf-8');
    }
  }

  private async read(): Promise<Record<string, any>> {
    await this.init();
    const data = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(data);
  }

  private async write(data: Record<string, any>): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.read();
    return _.get(data, key, null) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const data = await this.read();
    _.set(data, key, value);
    await this.write(data);
  }

  async has(key: string): Promise<boolean> {
    const data = await this.read();
    return _.has(data, key);
  }

  async delete(key: string): Promise<boolean> {
    const data = await this.read();
    const result = _.has(data, key);
    
    if (result) {
      _.unset(data, key);
      await this.write(data);
    }
    
    return result;
  }

  async all(): Promise<Record<string, any>> {
    return await this.read();
  }

  async clear(): Promise<void> {
    await this.write({});
  }
}