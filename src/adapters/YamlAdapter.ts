import path from 'path';
import * as yaml from 'yaml';
import { FileAdapter, FileAdapterOptions } from './FileAdapter';

export class YamlAdapter extends FileAdapter {
  constructor(options: FileAdapterOptions = {}) {
    const folder = options.folder ?? 'data';
    const file = options.file ?? 'db.yaml';
    super(path.join(process.cwd(), folder, file), '');
  }

  protected serialize(data: Record<string, any>): string {
    return yaml.stringify(data);
  }

  protected deserialize(raw: string): Record<string, any> {
    return yaml.parse(raw) ?? {};
  }
}
