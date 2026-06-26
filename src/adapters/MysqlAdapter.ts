import mysql, { Pool } from 'mysql2/promise';
import { BaseAdapter } from './BaseAdapter';
import _ from 'lodash';

export class MysqlAdapter implements BaseAdapter {
  private pool: Pool;
  private tableName: string;
  private ready: Promise<void>;

  constructor(config: mysql.PoolOptions, tableName: string = 'ekmek_db') {
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
      throw new Error(
        `[ekmek-db] Invalid table name "${tableName}". Only letters, numbers and underscores are allowed.`
      );
    }
    this.pool = mysql.createPool(config);
    this.tableName = tableName;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (
        \`ID\` VARCHAR(255) PRIMARY KEY,
        \`data\` JSON NOT NULL
      )
    `;
    await this.pool.execute(query);
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ready;
    const [baseKey, ...rest] = key.split('.');
    const [rows]: any = await this.pool.execute(
      `SELECT \`data\` FROM \`${this.tableName}\` WHERE \`ID\` = ?`,
      [baseKey]
    );

    if (rows.length === 0) return null;

    const data = rows[0].data;
    if (rest.length === 0) return data as T;
    return _.get(data, rest.join('.'), null) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.ready;
    const [baseKey, ...rest] = key.split('.');

    if (rest.length === 0) {
      await this.pool.execute(
        `INSERT INTO \`${this.tableName}\` (\`ID\`, \`data\`) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`)`,
        [baseKey, JSON.stringify(value)]
      );
      return;
    }

    const current = await this.get<any>(baseKey) || {};
    _.set(current, rest.join('.'), value);

    await this.pool.execute(
      `INSERT INTO \`${this.tableName}\` (\`ID\`, \`data\`) VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE \`data\` = VALUES(\`data\`)`,
      [baseKey, JSON.stringify(current)]
    );
  }

  async has(key: string): Promise<boolean> {
    await this.ready;
    const [baseKey, ...rest] = key.split('.');
    const [rows]: any = await this.pool.execute(
      `SELECT \`data\` FROM \`${this.tableName}\` WHERE \`ID\` = ?`,
      [baseKey]
    );

    if (rows.length === 0) return false;
    if (rest.length === 0) return true;
    return _.has(rows[0].data, rest.join('.'));
  }

  async delete(key: string): Promise<boolean> {
    await this.ready;
    const [baseKey, ...rest] = key.split('.');

    if (rest.length === 0) {
      const [result]: any = await this.pool.execute(
        `DELETE FROM \`${this.tableName}\` WHERE \`ID\` = ?`,
        [baseKey]
      );
      return result.affectedRows > 0;
    }

    const current = await this.get<any>(baseKey);
    if (!current) return false;

    const hasProp = _.has(current, rest.join('.'));
    if (hasProp) {
      _.unset(current, rest.join('.'));
      await this.set(baseKey, current);
    }
    return hasProp;
  }

  async all(): Promise<Record<string, any>> {
    await this.ready;
    const [rows]: any = await this.pool.execute(`SELECT * FROM \`${this.tableName}\``);
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.ID] = row.data;
    }
    return result;
  }

  async clear(): Promise<void> {
    await this.ready;
    await this.pool.execute(`TRUNCATE TABLE \`${this.tableName}\``);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}