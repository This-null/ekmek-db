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
- **Crash-Safe Writes:** File adapters serialize writes and write atomically, so concurrent `set` calls never lose data or corrupt the file.
- **Typed Events:** Subscribe to `set`, `delete`, `clear`, and `close` events.
- **Web Dashboard:** A login-protected, bilingual (EN/TR), dark/light dashboard to manage your data live — no extra dependencies.

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
// add()/subtract() throw if the stored value is not a number.
```

## Utility Methods
```typescript
await db.keys();   // top-level keys      -> ['user', 'economy', ...]
await db.values(); // top-level values
await db.size();   // number of top-level entries

// get the value, or set & return a default if the key is missing
const profile = await db.ensure('user.profile', { level: 1, coins: 0 });
```

## Events
```typescript
db.on('set', (key, value) => console.log(`set ${key}`));
db.on('delete', (key) => console.log(`deleted ${key}`));
db.on('clear', () => console.log('database cleared'));
db.on('close', () => console.log('database closed'));
```

## Lifecycle
```typescript
// Releases underlying connections/pools (MongoDB, MySQL).
// No-op for Memory/JSON/YAML adapters, always safe to call.
await db.close();
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

---

# 🖥️ Web Dashboard

A self-contained, login-protected web dashboard to manage your database **live** from the browser — built on Node's native `http` and `crypto` modules, so it adds **zero runtime dependencies**. Tailwind CSS, a bento-grid layout, dark/light themes, and full English/Turkish localization.

![dashboard](https://img.shields.io/badge/UI-Tailwind%20%2B%20Bento-C6FF34?style=for-the-badge)

## What you can do

- **Live data control** — browse, add, edit (as JSON), and delete every key without touching a file.
- **Import / Export** — download a full JSON snapshot, or load a `.json` file (merge or replace).
- **Settings** — change the port/bind address (re-binds instantly), theme, language, and security — all from the UI.
- **Security** — IP allowlist / blocklist, read-only mode, login brute-force lockout, and a hashed admin password.
- **i18n** — every label is bound to language files (`en` / `tr`); switch with one click.

## Quick start (CLI)

The fastest way — a fresh install drops you straight on the setup screen:

```bash
# Run it directly (uses a JSON adapter at ./data/db.json)
npx ekmek-db dashboard

# Or pick a port / data file
npx ekmek-db dashboard --port 80 --folder data --file db.json
```

On first launch the console prints:

```
  🍞  ekmek-db dashboard active
      Local:    http://localhost:8080
      Network:  http://192.168.1.42:8080
```

Open the **Network** address from any device on your LAN. The first visit shows a **setup screen** where you create your admin username and password. Credentials are stored locally and **scrypt-hashed** — they never leave your machine.

## Quick start (programmatic)

Attach the dashboard to your own `EkmekDB` instance so the data you manage is the data your app uses:

```typescript
import { EkmekDB, JsonAdapter, Dashboard } from 'ekmek-db';

const db = new EkmekDB(new JsonAdapter({ folder: 'data', file: 'db.json' }));

const dashboard = new Dashboard(db, {
  port: 8080,          // default 8080
  host: '0.0.0.0',     // default '0.0.0.0' → reachable on the LAN
  dbName: 'My App DB', // shown in the UI
});

await dashboard.start();
// The dashboard stays up while your process runs.
// Console: 🍞 ekmek-db dashboard active → http://192.168.1.42:8080
```

### Dashboard options

| Option | Default | Description |
| --- | --- | --- |
| `port` | `8080` | Port to listen on (use `80` for the default web port; may require admin rights). |
| `host` | `'0.0.0.0'` | Bind address. `0.0.0.0` exposes it on the LAN; `127.0.0.1` keeps it local-only. |
| `configPath` | `./ekmek-dashboard.config.json` | Where admin credentials & settings are stored. |
| `dbName` | `'ekmek-db'` | Display name in the UI. |
| `quiet` | `false` | Suppress the console banner. |

## 🔒 Security — read before exposing it to the internet

The dashboard is built for a **local network**. If you forward a port on your router to expose it to the outside world, harden it first:

- **Set a strong admin password** (minimum 8 characters; longer is better). It is stored only as a scrypt salt + hash.
- **Use the IP allowlist** (Settings → Security). When set, **only** the listed IPs can connect — everything else gets `403`.
- **Brute-force lockout** is on by default: after N failed logins an IP is locked out. Tune the attempt count and lockout duration in Settings.
- **Read-only mode** blocks every change to your data while keeping the dashboard browsable — handy when exposing a live view.
- **Sessions** are HttpOnly, `SameSite=Strict` cookies with a configurable lifetime; changing the password invalidates all sessions.
- **Bind to `127.0.0.1`** if you only need local access, so the port is never reachable from the network at all.

> The config file (`ekmek-dashboard.config.json`) is written with restrictive permissions and holds your hashed password and server secret. Keep it out of version control (add it to `.gitignore`).

## Changing the port

Change it from **Settings → Server**. The server re-binds to the new port immediately and the UI redirects you to the new address — no manual restart needed. (You can also set it via the `port` option or `--port` flag.)

