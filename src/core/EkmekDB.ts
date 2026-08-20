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

  async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
    if (!Array.isArray(keys)) throw new Error('[ekmek-db] mget() requires an array of keys.');
    const all = await this.all();
    const out: Record<string, T | null> = {};
    for (const key of keys) {
      this.assertKey(key);
      out[key] = (_.get(all, key, null) as T | null);
    }
    return out;
  }

  async mset(entries: Record<string, unknown>): Promise<number> {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
      throw new Error('[ekmek-db] mset() requires a plain object.');
    }
    let count = 0;
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value);
      count += 1;
    }
    return count;
  }

  async mdelete(keys: string[]): Promise<number> {
    if (!Array.isArray(keys)) throw new Error('[ekmek-db] mdelete() requires an array of keys.');
    let removed = 0;
    for (const key of keys) {
      if (await this.delete(key)) removed += 1;
    }
    return removed;
  }

  async where<T>(predicate: (value: T, key: string) => boolean): Promise<Array<{ key: string; value: T }>> {
    if (typeof predicate !== 'function') throw new Error('[ekmek-db] where() requires a predicate function.');
    const all = await this.all();
    const out: Array<{ key: string; value: T }> = [];
    for (const [key, value] of Object.entries(all)) {
      if (predicate(value as T, key)) out.push({ key, value: value as T });
    }
    return out;
  }

  async backup(): Promise<Record<string, any>> {
    return _.cloneDeep(await this.all());
  }

  async restore(snapshot: Record<string, any>, options: { merge?: boolean } = {}): Promise<number> {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      throw new Error('[ekmek-db] restore() requires a plain object snapshot.');
    }
    if (!options.merge) await this.clear();
    let count = 0;
    for (const [key, value] of Object.entries(snapshot)) {
      await this.set(key, value);
      count += 1;
    }
    return count;
  }

  namespace(prefix: string): Namespace {
    if (typeof prefix !== 'string' || prefix.length === 0) {
      throw new Error('[ekmek-db] namespace() requires a non-empty prefix.');
    }
    if (prefix.includes('.')) {
      throw new Error('[ekmek-db] namespace prefix cannot contain a dot.');
    }
    return new Namespace(this, prefix);
  }

  async close(): Promise<void> {
    if (typeof this.adapter.close === 'function') {
      await this.adapter.close();
    }
    this.emit('close');
  }
}

export class Namespace {
  constructor(private db: EkmekDB, readonly prefix: string) {}

  private scoped(key: string): string {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('[ekmek-db] Key must be a non-empty string.');
    }
    return `${this.prefix}.${key}`;
  }

  get<T>(key: string): Promise<T | null> {
    return this.db.get<T>(this.scoped(key));
  }

  set<T>(key: string, value: T): Promise<void> {
    return this.db.set<T>(this.scoped(key), value);
  }

  has(key: string): Promise<boolean> {
    return this.db.has(this.scoped(key));
  }

  delete(key: string): Promise<boolean> {
    return this.db.delete(this.scoped(key));
  }

  add(key: string, value: number): Promise<void> {
    return this.db.add(this.scoped(key), value);
  }

  subtract(key: string, value: number): Promise<void> {
    return this.db.subtract(this.scoped(key), value);
  }

  push<T>(key: string, value: T): Promise<void> {
    return this.db.push<T>(this.scoped(key), value);
  }

  pull<T>(key: string, value: T | ((item: T) => boolean)): Promise<void> {
    return this.db.pull<T>(this.scoped(key), value);
  }

  ensure<T>(key: string, defaultValue: T): Promise<T> {
    return this.db.ensure<T>(this.scoped(key), defaultValue);
  }

  find<T>(key: string, predicate: (item: T) => boolean): Promise<T | undefined> {
    return this.db.find<T>(this.scoped(key), predicate);
  }

  filter<T>(key: string, predicate: (item: T) => boolean): Promise<T[]> {
    return this.db.filter<T>(this.scoped(key), predicate);
  }

  async all(): Promise<Record<string, any>> {
    return ((await this.db.get<Record<string, any>>(this.prefix)) as Record<string, any>) ?? {};
  }

  async keys(): Promise<string[]> {
    return Object.keys(await this.all());
  }

  async size(): Promise<number> {
    return (await this.keys()).length;
  }

  async clear(): Promise<void> {
    await this.db.delete(this.prefix);
  }
}
