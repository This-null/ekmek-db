import { BaseAdapter } from './BaseAdapter';
import _ from 'lodash';

export class MemoryAdapter implements BaseAdapter {
  private data: Record<string, any> = {};

  async get<T>(key: string): Promise<T | null> {
    return _.get(this.data, key, null) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    _.set(this.data, key, value);
  }

  async has(key: string): Promise<boolean> {
    return _.has(this.data, key);
  }

  async delete(key: string): Promise<boolean> {
    const result = _.has(this.data, key);
    if (result) {
      _.unset(this.data, key);
    }
    return result;
  }

  async all(): Promise<Record<string, any>> {
    return _.cloneDeep(this.data);
  }

  async clear(): Promise<void> {
    this.data = {};
  }
}