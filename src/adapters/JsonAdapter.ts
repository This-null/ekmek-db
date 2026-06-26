import path from 'path';
import { FileAdapter, FileAdapterOptions } from './FileAdapter';

export class JsonAdapter extends FileAdapter {
  constructor(options: FileAdapterOptions = {}) {
    const folder = options.folder ?? 'data';
    const file = options.file ?? 'db.json';
    super(path.join(process.cwd(), folder, file), '{}');
  }

  protected serialize(data: Record<string, any>): string {
    return JSON.stringify(data, null, 2);
  }

  protected deserialize(raw: string): Record<string, any> {
    return JSON.parse(raw);
  }
}
