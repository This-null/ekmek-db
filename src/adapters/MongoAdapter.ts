import { MongoClient, Db, Collection } from 'mongodb';
import { BaseAdapter } from './BaseAdapter';
import _ from 'lodash';

export class MongoAdapter implements BaseAdapter {
  private client: MongoClient;
  private dbName: string;
  private collectionName: string;
  private db: Db | null = null;
  private collection: Collection | null = null;

  constructor(url: string, dbName: string = 'EkmekDB', collectionName: string = 'JSONData') {
    this.client = new MongoClient(url);
    this.dbName = dbName;
    this.collectionName = collectionName;
  }

  private async connect(): Promise<Collection> {
    if (!this.collection) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection(this.collectionName);
    }
    return this.collection;
  }

  async get<T>(key: string): Promise<T | null> {
    const col = await this.connect();
    const [baseKey, ...rest] = key.split('.');
    
    const document = await col.findOne({ ID: baseKey });
    if (!document) return null;

    if (rest.length === 0) return document.data as T;
    return _.get(document.data, rest.join('.'), null) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const col = await this.connect();
    const [baseKey, ...rest] = key.split('.');

    if (rest.length === 0) {
      await col.updateOne(
        { ID: baseKey },
        { $set: { ID: baseKey, data: value } },
        { upsert: true }
      );
      return;
    }

    const document = await col.findOne({ ID: baseKey });
    const currentData = document ? document.data : {};
    
    _.set(currentData, rest.join('.'), value);

    await col.updateOne(
      { ID: baseKey },
      { $set: { ID: baseKey, data: currentData } },
      { upsert: true }
    );
  }

  async has(key: string): Promise<boolean> {
    const col = await this.connect();
    const [baseKey, ...rest] = key.split('.');

    const document = await col.findOne({ ID: baseKey });
    if (!document) return false;

    if (rest.length === 0) return true;
    return _.has(document.data, rest.join('.'));
  }

  async delete(key: string): Promise<boolean> {
    const col = await this.connect();
    const [baseKey, ...rest] = key.split('.');

    if (rest.length === 0) {
      const result = await col.deleteOne({ ID: baseKey });
      return result.deletedCount > 0;
    }

    const document = await col.findOne({ ID: baseKey });
    if (!document) return false;

    const currentData = document.data;
    const hasProperty = _.has(currentData, rest.join('.'));

    if (hasProperty) {
      _.unset(currentData, rest.join('.'));
      await col.updateOne(
        { ID: baseKey },
        { $set: { data: currentData } }
      );
    }

    return hasProperty;
  }

  async all(): Promise<Record<string, any>> {
    const col = await this.connect();
    const documents = await col.find({}).toArray();
    const result: Record<string, any> = {};

    for (const doc of documents) {
      result[doc.ID] = doc.data;
    }

    return result;
  }

  async clear(): Promise<void> {
    const col = await this.connect();
    await col.deleteMany({});
  }

  async close(): Promise<void> {
    await this.client.close();
    this.db = null;
    this.collection = null;
  }
}
