import { BaseAdapter } from '../adapters/BaseAdapter';

export class Migrator {
  static async transfer(source: BaseAdapter, target: BaseAdapter): Promise<void> {
    const allData = await source.all();
    
    for (const [key, value] of Object.entries(allData)) {
      await target.set(key, value);
    }
  }

  static async transferFromQuickDB(quickDbInstance: any, target: BaseAdapter): Promise<void> {
    const allData = quickDbInstance.all();
    
    for (const item of allData) {
      await target.set(item.ID, item.data);
    }
  }

  static async transferFromJSON(jsonFilePath: string, target: BaseAdapter): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');
    
    const fullPath = path.resolve(process.cwd(), jsonFilePath);
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    const parsedData = JSON.parse(fileContent);

    for (const [key, value] of Object.entries(parsedData)) {
      await target.set(key, value);
    }
  }
}