import { BaseAdapter } from '../adapters/BaseAdapter';
import { EventEmitter } from 'node:events';
import _ from 'lodash';

export class EkmekDB extends EventEmitter {
  private adapter: BaseAdapter;

  constructor(adapter: BaseAdapter) {
    super();
    this.adapter = adapter;
  }

  async get<T>(key: string): Promise<T | null> {
    return await this.adapter.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.adapter.set<T>(key, value);
    this.emit('set', key, value);
  }

  async has(key: string): Promise<boolean> {
    return await this.adapter.has(key);
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.adapter.delete(key);
    if (result) {
      this.emit('delete', key);
    }
    return result;
  }

  async all(): Promise<Record<string, any>> {
    return await this.adapter.all();
  }

  async clear(): Promise<void> {
    await this.adapter.clear();
    this.emit('clear');
  }

  async deleteAll(): Promise<void> {
    await this.clear();
  }

  async add(key: string, value: number): Promise<void> {
    const current = (await this.get<number>(key)) || 0;
    await this.set(key, current + value);
  }

  async subtract(key: string, value: number): Promise<void> {
    const current = (await this.get<number>(key)) || 0;
    await this.set(key, current - value);
  }

  async push<T>(key: string, value: T): Promise<void> {
    const current = (await this.get<T[]>(key)) || [];
    if (!Array.isArray(current)) {
      throw new Error('Target is not an array');
    }
    current.push(value);
    await this.set(key, current);
  }

  async pull<T>(key: string, value: T | ((item: T) => boolean)): Promise<void> {
    let current = (await this.get<T[]>(key)) || [];
    if (!Array.isArray(current)) {
      throw new Error('Target is not an array');
    }

    if (typeof value === 'function') {
      current = current.filter((item) => !(value as (item: T) => boolean)(item));
    } else {
      current = current.filter((item) => !_.isEqual(item, value));
    }

    await this.set(key, current);
  }

  async unpush<T>(key: string, value: T): Promise<void> {
    await this.pull(key, value);
  }

  async delByPriority(key: string, index: number): Promise<void> {
    const current = (await this.get<any[]>(key)) || [];
    if (!Array.isArray(current)) {
      throw new Error('Target is not an array');
    }
    
    if (index > 0 && index <= current.length) {
      current.splice(index - 1, 1);
      await this.set(key, current);
    }
  }

  async setByPriority<T>(key: string, value: T, index: number): Promise<void> {
    const current = (await this.get<any[]>(key)) || [];
    if (!Array.isArray(current)) {
      throw new Error('Target is not an array');
    }

    if (index > 0 && index <= current.length) {
      current[index - 1] = value;
    } else if (index > current.length) {
      current.push(value);
    }

    await this.set(key, current);
  }

  async find<T>(key: string, predicate: (item: T) => boolean): Promise<T | undefined> {
    const current = (await this.get<T[]>(key)) || [];
    if (!Array.isArray(current)) {
      throw new Error('Target is not an array');
    }
    return current.find(predicate);
  }

  async filter<T>(key: string, predicate: (item: T) => boolean): Promise<T[]> {
    const current = (await this.get<T[]>(key)) || [];
    if (!Array.isArray(current)) {
      throw new Error('Target is not an array');
    }
    return current.filter(predicate);
  }
}