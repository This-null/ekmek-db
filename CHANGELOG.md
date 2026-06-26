# Changelog

## 0.0.5

### Added — Web Dashboard 🖥️
- A self-contained, login-protected **web dashboard** (`Dashboard` class + `ekmek-db dashboard` CLI) to manage a database live from the browser. Built on Node's native `http`/`crypto` — **zero new runtime dependencies**.
  - Tailwind CSS + bento-grid UI, **dark/light themes**, and full **English/Turkish** localization (everything bound to `i18n` language files).
  - First-run **setup screen**: create an admin whose password is stored locally and **scrypt-hashed**.
  - **Live data control** (browse / add / edit-as-JSON / delete), **import / export** JSON (merge or replace), and a **settings** page.
  - Change the **port/bind address from the UI** — the server re-binds instantly and redirects you.
  - **Security**: IP allowlist / blocklist, read-only mode, login brute-force lockout, HttpOnly `SameSite=Strict` sessions, and security headers.
  - Console banner on start: `🍞 ekmek-db dashboard active` with the local + LAN URLs.

### Fixed
- **Packaging:** the published package no longer ships without compiled output. `dist/` is `.gitignore`d, so npm previously excluded it; added an explicit `files` allowlist in `package.json`.
- **Lost updates on file adapters:** concurrent `set`/`delete` calls on `JsonAdapter`/`YamlAdapter` could silently drop writes (read-modify-write race). Writes are now serialized through a mutex.
- **File corruption on crash:** file adapters now write to a temp file and atomically rename it over the target.
- **Constructor race:** `JsonAdapter`, `YamlAdapter`, and `MysqlAdapter` no longer fire-and-forget their async `init()`; operations await readiness.
- **Inconsistent `has()`:** `MongoAdapter` and `MysqlAdapter` now report key-path existence (matching the file/memory adapters) instead of treating a stored `null` as "missing".
- **`MemoryAdapter.all()`** now returns a deep clone instead of a live reference to the internal store.
- **`add()` / `subtract()`** now validate the argument and the stored value are numbers.
- **`Migrator.transferFromQuickDB`** now awaits `quickDbInstance.all()`.
- Malformed database files now throw a clear, path-prefixed parse error.

### Added — Core
- `EkmekDB.close()` and an optional `BaseAdapter.close()` to release DB connections/pools (implemented for Mongo + MySQL).
- Utility methods: `keys()`, `values()`, `size()`, and `ensure(key, default)`.
- Typed events (`set`, `delete`, `clear`, `close`) via an `EkmekDBEventMap`.
- Shared `FileAdapter` base class behind `JsonAdapter`/`YamlAdapter`, plus an exported `FileAdapterOptions` type.
- Key validation, MySQL table-name validation, `engines.node >= 16`, and a `LICENSE` file.
