import { BaseAdapter } from '../adapters/BaseAdapter';
import { EventEmitter } from 'node:events';
import _ from 'lodash';

export interface EkmekDBEventMap {
  set: [key: string, value: unknown];
  delete: [key: string];
  clear: [];
  close: [];
}

export declare interface EkmekDB {
  on<K extends keyof EkmekDBEventMap>(event: K, listener: (...args: EkmekDBEventMap[K]) => void): this;
  once<K extends keyof EkmekDBEventMap>(event: K, listener: (...args: EkmekDBEventMap[K]) => void): this;
  off<K extends keyof EkmekDBEventMap>(event: K, listener: (...args: EkmekDBEventMap[K]) => void): this;
  emit<K extends keyof EkmekDBEventMap>(event: K, ...args: EkmekDBEventMap[K]): boolean;
}

export class EkmekDB extends EventEmitter {
  private adapter: BaseAdapter;

  constructor(adapter: BaseAdapter) {
    super();
    this.adapter = adapter;
  }

  private assertKey(key: string): void {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('[ekmek-db] Key must be a non-empty string.');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.assertKey(key);
    return await this.adapter.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.assertKey(key);
    await this.adapter.set<T>(key, value);
    this.emit('set', key, value);
  }

  async has(key: string): Promise<boolean> {
    this.assertKey(key);
    return await this.adapter.has(key);
  }

  async delete(key: string): Promise<boolean> {
    this.assertKey(key);
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

  async keys(): Promise<string[]> {
    return Object.keys(await this.all());
  }

  async values(): Promise<any[]> {
    return Object.values(await this.all());
  }

  async size(): Promise<number> {
    return (await this.keys()).length;
  }

  async ensure<T>(key: string, defaultValue: T): Promise<T> {
    this.assertKey(key);
    if (await this.has(key)) {
      return (await this.get<T>(key)) as T;
    }
    await this.set(key, defaultValue);
    return defaultValue;
  }

  async add(key: string, value: number): Promise<void> {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('[ekmek-db] add() requires a numeric value.');
    }
    const current = await this.get<number>(key);
    if (current !== null && typeof current !== 'number') {
      throw new Error(`[ekmek-db] Cannot add: value at "${key}" is not a number.`);
    }
    await this.set(key, (current ?? 0) + value);
  }

  async subtract(key: string, value: number): Promise<void> {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('[ekmek-db] subtract() requires a numeric value.');
    }
    const current = await this.get<number>(key);
    if (current !== null && typeof current !== 'number') {
      throw new Error(`[ekmek-db] Cannot subtract: value at "${key}" is not a number.`);
    }
    await this.set(key, (current ?? 0) - value);
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

  async close(): Promise<void> {
    if (typeof this.adapter.close === 'function') {
      await this.adapter.close();
    }
    this.emit('close');
  }
}
