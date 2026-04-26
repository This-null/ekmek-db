export interface BaseAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  all(): Promise<Record<string, any>>;
  clear(): Promise<void>;
}