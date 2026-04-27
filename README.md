# 🍞 ekmek-db

![npm bundle size](https://img.shields.io/bundlephobia/min/ekmek-db?style=for-the-badge)
![npm unpacked size](https://img.shields.io/npm/unpacked-size/ekmek-db?style=for-the-badge&color=orange)
![npm](https://img.shields.io/npm/dt/ekmek-db?style=for-the-badge&color=blue)
![npm version](https://img.shields.io/npm/v/ekmek-db?style=for-the-badge&color=success)
![Discord](https://img.shields.io/discord/1321974421937721364?label=Discord&logo=discord&style=for-the-badge&color=7289da)
![License](https://img.shields.io/npm/l/ekmek-db?style=for-the-badge)

A modern, robust, type-safe, and lightweight database wrapper for Node.js.

## Features

- **Type-Safe:** Built with TypeScript for full autocompletion and type safety.
- **Multiple Adapters:** Seamlessly switch between JSON, YAML, MongoDB, and Memory.
- **Advanced Array Methods:** Easily manipulate array data with index-based priority controls.
- **Dot Notation:** Easily access deep object properties directly.
- **Data Migration:** Transfer your data across different adapters smoothly.

---

# Installation

```bash
npm install ekmek-db
```
## MysqlAdapter
- Perfect for web applications and production environments where you need a centralized SQL database.
```typescript
import { EkmekDB, MysqlAdapter } from 'ekmek-db';

const db = new EkmekDB(new MysqlAdapter({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'your_database',
  // Optional: all other mysql2 pool options are supported
}, 'table_name')); // Optional: Default table name is 'ekmek_db'

async function setup() {
  await db.set('server.status', 'online');
  
  const status = await db.get('server.status');
  console.log(`Server is ${status}`);
}

setup();
```
## Adapters Setup
- Initialize your database with the adapter that fits your project.

## JsonAdapter
```typescript
import { EkmekDB, JsonAdapter } from 'ekmek-db';

const db = new EkmekDB(new JsonAdapter({ folder: 'data', file: 'database.json' }));
```

## YamlAdapter
```typescript
import { EkmekDB, YamlAdapter } from 'ekmek-db';

const db = new EkmekDB(new YamlAdapter({ folder: 'data', file: 'database.yaml' }));
```

## MongoAdapter
```typescript
import { EkmekDB, MongoAdapter } from 'ekmek-db';

const db = new EkmekDB(new MongoAdapter('YOUR_MONGO_URL_HERE'));
```
## MemoryAdapter
```typescript
import { EkmekDB, MemoryAdapter } from 'ekmek-db';

const db = new EkmekDB(new MemoryAdapter());
```

## Basic Operations

```typescript
await db.set('user.name', 'Admin');
await db.set('user.stats.level', 42);

await db.get('user.name');
await db.get('user.stats');

await db.has('user.stats.level');

await db.all();

await db.delete('user.name');
await db.clear();
```

## Math Operations
```typescript
await db.set('economy.balance', 1000);

await db.add('economy.balance', 500);

await db.subtract('economy.balance', 200);
```

## Advanced Array Operations
```typescript
await db.push('guild.members', { id: '123', role: 'User' });
await db.push('guild.members', { id: '456', role: 'Moderator' });

await db.pull('guild.members', (member) => member.id === '123');
await db.unpush('guild.members', { id: '456', role: 'Moderator' });

await db.setByPriority('guild.members', { id: '789', role: 'Owner' }, 1);

await db.delByPriority('guild.members', 1);

await db.find('guild.members', (member) => member.role === 'Owner');
await db.filter('guild.members', (member) => member.role !== 'Banned');
```

# Migration System
- Transfer your entire dataset from one adapter to another effortlessly.
```typescript
import { JsonAdapter, MongoAdapter, Migrator } from 'ekmek-db';

async function runMigration() {
  const jsonAdapter = new JsonAdapter({ folder: 'data', file: 'old.json' });
  const mongoAdapter = new MongoAdapter('YOUR_MONGO_URL_HERE');

  await Migrator.transfer(jsonAdapter, mongoAdapter);
}

runMigration();
```
