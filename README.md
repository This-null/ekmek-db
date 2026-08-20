# 🍞 ekmek-db

![npm bundle size](https://img.shields.io/bundlephobia/min/ekmek-db?style=for-the-badge)
![npm unpacked size](https://img.shields.io/npm/unpacked-size/ekmek-db?style=for-the-badge&color=orange)
![npm](https://img.shields.io/npm/dt/ekmek-db?style=for-the-badge&color=blue)
![npm version](https://img.shields.io/npm/v/ekmek-db?style=for-the-badge&color=success)
![Discord](https://img.shields.io/discord/1321974421937721364?label=Discord&logo=discord&style=for-the-badge&color=7289da)
![License](https://img.shields.io/npm/l/ekmek-db?style=for-the-badge)

A modern, robust, type-safe, and lightweight database wrapper for Node.js — with a built-in web dashboard.

## Features

- **Type-safe** — written in TypeScript, full autocompletion end to end.
- **Multiple adapters** — JSON, YAML, MongoDB, MySQL, and Memory behind one API.
- **Dot notation** — reach deep properties directly: `db.get('user.stats.level')`.
- **Cached reads** — file adapters keep a validated in-memory copy, so repeated reads cost a `stat` instead of a full read + parse. Edits made outside the process are still picked up.
- **Crash-safe writes** — writes are serialized and atomic, so concurrent `set` calls never lose data or leave a half-written file.
- **Namespaces** — `db.namespace('users')` gives you an isolated, prefix-scoped view.
- **Batch operations** — `mget`, `mset`, `mdelete` for working with many keys at once.
- **Backup & restore** — snapshot the whole dataset and put it back, in replace or merge mode.
- **Typed events** — `set`, `delete`, `clear`, `close`.
- **Web dashboard** — login-protected, 8 languages, dark/light, mobile-ready, and dependency-free.

---

# Installation

```bash
npm install ekmek-db
```

# Adapters

Pick the adapter that fits your project; the API is identical for all of them.

```typescript
import { EkmekDB, JsonAdapter } from 'ekmek-db';

const db = new EkmekDB(new JsonAdapter({ folder: 'data', file: 'database.json' }));
```

```typescript
import { EkmekDB, YamlAdapter, MemoryAdapter, MongoAdapter, MysqlAdapter } from 'ekmek-db';

new EkmekDB(new YamlAdapter({ folder: 'data', file: 'database.yaml' }));
new EkmekDB(new MemoryAdapter());
new EkmekDB(new MongoAdapter('YOUR_MONGO_URL_HERE'));

new EkmekDB(new MysqlAdapter({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'your_database',
}, 'table_name'));
```

File adapters cache reads by default. Pass `cache: false` if another process rewrites the file constantly and you would rather pay for a fresh read every time:

```typescript
new EkmekDB(new JsonAdapter({ folder: 'data', file: 'db.json', cache: false }));
```

# Basic operations

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

# Utility methods

```typescript
await db.keys();   // top-level keys -> ['user', 'economy', ...]
await db.values();
await db.size();

// read the value, or write and return a default when the key is missing
const profile = await db.ensure('user.profile', { level: 1, coins: 0 });
```

# Math operations

```typescript
await db.set('economy.balance', 1000);
await db.add('economy.balance', 500);
await db.subtract('economy.balance', 200);
// add() / subtract() throw if the stored value is not a number.
```

# Batch operations

Work with many keys in one call instead of a loop of awaits.

```typescript
await db.mset({
  'user.a.coins': 100,
  'user.b.coins': 250,
  'server.status': 'online',
});

await db.mget(['user.a.coins', 'user.b.coins']);
// -> { 'user.a.coins': 100, 'user.b.coins': 250 }

await db.mdelete(['user.a.coins', 'user.b.coins']); // -> 2 (number actually removed)
```

# Querying

`where()` runs a predicate over the top-level entries and returns the matches with their keys.

```typescript
await db.set('alice', { level: 5 });
await db.set('bob', { level: 60 });

await db.where((value) => value.level > 40);
// -> [{ key: 'bob', value: { level: 60 } }]
```

# Namespaces

A namespace is a prefix-scoped view of the same database — handy for keeping guilds, users, or features from colliding.

```typescript
const users = db.namespace('users');

await users.set('mustafa.coins', 100);
await users.add('mustafa.coins', 50);

await users.get('mustafa.coins');     // 150
await db.get('users.mustafa.coins');  // 150 — same value, full path

await users.keys();  // ['mustafa'] — unprefixed
await users.clear(); // drops only the users subtree
```

Namespaces support `get`, `set`, `has`, `delete`, `add`, `subtract`, `push`, `pull`, `ensure`, `find`, `filter`, `all`, `keys`, `size`, and `clear`.

# Backup & restore

```typescript
const snapshot = await db.backup(); // detached deep copy of everything

await db.restore(snapshot);                 // replace: wipes first, then writes
await db.restore(partial, { merge: true }); // merge: keeps existing keys
```

# Advanced array operations

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

# Events

```typescript
db.on('set', (key, value) => console.log(`set ${key}`));
db.on('delete', (key) => console.log(`deleted ${key}`));
db.on('clear', () => console.log('database cleared'));
db.on('close', () => console.log('database closed'));
```

# Lifecycle

```typescript
// Releases underlying connections/pools (MongoDB, MySQL).
// No-op for Memory/JSON/YAML adapters, always safe to call.
await db.close();
```

# Migration system

Transfer an entire dataset from one adapter to another.

```typescript
import { JsonAdapter, MongoAdapter, Migrator } from 'ekmek-db';

const jsonAdapter = new JsonAdapter({ folder: 'data', file: 'old.json' });
const mongoAdapter = new MongoAdapter('YOUR_MONGO_URL_HERE');

await Migrator.transfer(jsonAdapter, mongoAdapter);
```

---

# 🖥️ Web Dashboard

A self-contained, login-protected web dashboard to manage your database **live** from the browser — built on Node's native `http` and `crypto` modules, so it adds **zero runtime dependencies** and loads no third-party script.

![dashboard](https://img.shields.io/badge/UI-Bento%20%2B%20Mobile-99E1D9?style=for-the-badge)

## What you can do

- **Data folder file manager** — reads every `.json` file in your data folder and lets you edit each one **as a whole file** in a full-height editor with line numbers and syntax highlighting. Create, upload, rename, duplicate, download, and delete files from the UI (drag a `.json` onto the list to upload it).
- **Version history** — every save keeps a snapshot (last 15 per file); restore any of them from the editor menu.
- **Search across files** — content search with file and line hits, from the top bar or `Ctrl/Cmd+K`. `Ctrl/Cmd+S` saves.
- **Works on phones** — master/detail navigation, a 16px editor that never triggers iOS zoom, line wrapping, keyboard-aware layout, and safe-area insets.
- **Import / Export** — download a full JSON snapshot, or load a `.json` file (merge or replace).
- **Settings** — port/bind address (re-binds instantly), theme, language, and security, all from the UI.
- **8 languages** — English, Türkçe, Русский, Deutsch, Azərbaycan, Français, 中文, 日本語. Every label is bound to the language files.
- **Dark & light themes** in Wine Ash `#32292F` + Turquoise `#99E1D9`.
- **Animated UI** — staggered entrances and micro-interactions, all disabled under `prefers-reduced-motion`.

## Quick start (CLI)

A fresh install drops you straight on the setup screen:

```bash
# Uses a JSON adapter at ./data/db.json
npx ekmek-db dashboard

# Or pick a port / data folder
npx ekmek-db dashboard --port 80 --folder data --file db.json
```

On launch the console prints:

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
```

### Dashboard options

| Option | Default | Description |
| --- | --- | --- |
| `port` | `8080` | Port to listen on (use `80` for the default web port; may require admin rights). |
| `host` | `'0.0.0.0'` | Bind address. `0.0.0.0` exposes it on the LAN; `127.0.0.1` keeps it local-only. |
| `dataDir` | `./data` | Folder whose `.json` files the file manager reads and edits. |
| `configPath` | `./ekmek-dashboard.config.json` | Where admin credentials & settings are stored. |
| `dbName` | `'ekmek-db'` | Display name in the UI. |
| `quiet` | `false` | Suppress the console banner. |

## 🔒 Security

The dashboard is built for a **local network**. If you forward a port on your router to expose it to the outside world, harden it first:

- **Set a strong admin password** (minimum 8 characters). It is stored only as a scrypt salt + hash, and a wrong username costs the same work as a wrong password, so logins never reveal whether an account exists.
- **Use the IP allowlist** (Settings → Security). When set, **only** the listed IPs can connect. Localhost is always allowed and your current IP is added automatically, so you can never lock yourself out.
- **Brute-force lockout** is on by default: after N failed logins an IP is locked out. Tune the count and duration in Settings.
- **CSRF protection** — every state-changing request needs a per-session token, compared in constant time, on top of `SameSite=Strict` cookies.
- **Strict CSP** — `script-src 'self'` with `base-uri 'none'` and `object-src 'none'`. No inline scripts, no `eval`, no CDN.
- **Honeypot traps** — common attack paths (`/wp-login.php`, `/.env`, `/phpmyadmin`, …) and a hidden form field are logged and rejected.
- **Access & security log** (Settings → Security) records logins, failed attempts, blocked IPs, honeypot hits, and config changes with timestamp, IP, and browser. Stored in `ekmek-dashboard.log.json`.
- **Read-only mode** blocks every change to your data while keeping the dashboard browsable.
- **Bind to `127.0.0.1`** if you only need local access, so the port is never reachable from the network at all.

> The config file (`ekmek-dashboard.config.json`) holds your hashed password. Keep it and `ekmek-dashboard.log.json` out of version control — both are already in this project's `.gitignore`.

## Changing the port

Change it from **Settings → Server**. The server re-binds immediately and the UI redirects you to the new address.
