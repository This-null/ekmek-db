# Changelog

## 0.0.8

### Fixed — mobile
- **Editor was unusable on phones.** The textarea rendered at 13px, so iOS auto-zoomed on focus and the page felt stuck. The editor now renders at 16px on touch devices, so tapping in no longer zooms.
- **No line wrapping**, which forced horizontal scrolling through long JSON. Added a wrap toggle (on by default on touch, remembered per device); the gutter hides while wrapped so the text and highlight layers stay aligned.
- **File list and editor were crammed together** — the list was squeezed into a 36vh strip above the editor. Phones now get proper master/detail navigation: the list fills the screen, tapping a file slides in a full-height editor with a back button.
- **Action buttons wrapped into a pile** in the editor header. They collapse into icons plus an overflow menu on narrow screens.
- **The drawer had no backdrop** and could not be dismissed by tapping outside. Added a scrim, tap-to-close, and Escape.
- **Layout jumped when the soft keyboard opened.** The shell now tracks `visualViewport`.
- Safe-area insets for notched devices, 44px-class touch targets, and the security log renders as cards instead of an unreadable five-column table.
- **File list header overflowed its column** by ~17px because the directory path had a hard `max-width`; the title block now shrinks and the path truncates from the left so the folder name stays visible.
- The auth footer’s theme button rendered as an empty circle (`.ghost-pill` never sized its icon), and its language pill was hardcoded to `EN · TR`.

### Added — dashboard
- **8 languages**: English, Türkçe, Русский, Deutsch, Azərbaycan, Français, 中文, 日本語 — every string is bound to the language files, with a picker in the top bar and in Settings. Unknown or failed locales fall back to English instead of blanking the page.
- **New palette**: Wine Ash `#32292F` and Turquoise `#99E1D9` across both themes.
- **Upload from device**: the add button now offers an empty file or a JSON upload; files can also be dropped onto the file list. Names are sanitized, contents validated, and clashes ask before overwriting.
- **Version history**: every save snapshots the file (last 15 kept) and any snapshot can be restored from the editor menu.
- **File operations**: rename, duplicate, and download individual files.
- **Search across files** (content search with file + line hits) reachable from the top bar or `Ctrl/Cmd+K`, plus a name filter in the file list.
- `Ctrl/Cmd+S` saves; unsaved changes prompt before navigating away or closing the tab.
- Sidebar user card with avatar and live status.

### Added — core
- **Cached reads for file adapters.** Every `get()` used to re-read and re-parse the whole file; the adapter now keeps a validated in-memory copy and only pays a `stat` per read. External edits (the dashboard, another process) are still picked up via mtime+size validation, and returned objects are detached copies so callers cannot corrupt the cache. Opt out with `cache: false`.
- **Namespaces** — `db.namespace('users')` returns a prefix-scoped view with the usual read/write/array helpers plus `keys`, `size`, and a `clear` that only drops its own subtree.
- **Batch operations** — `mget`, `mset`, and `mdelete`.
- **`where(predicate)`** — filter top-level entries and get back `{ key, value }` matches.
- **`backup()` / `restore(snapshot, { merge })`** — detached snapshot of the whole dataset, restored in replace or merge mode.

### Security
- **Removed the Tailwind CDN.** It was dead weight (three of the five classes were already ours) and it forced `unsafe-inline` and `unsafe-eval` in the script CSP plus a third-party origin. The policy is now `script-src 'self'` with `base-uri 'none'`, `object-src 'none'`, and `form-action 'self'`; the dashboard also no longer loads any script from the network.
- **Login no longer leaks whether a username exists** — a wrong username now costs the same scrypt work as a wrong password.
- CSRF tokens are compared in constant time.
- Search and listing are bounded (query length, bytes scanned, per-file parse size) so a large data folder cannot be used to stall the server.
- Snapshot restore validates the timestamp, and deleting a file removes its snapshots.

## 0.0.7

### Added — Dashboard
- **Data folder file manager:** the Data tab now reads every `.json` file in your data folder (configurable via the new `dataDir` option, default `./data`) and lets you edit each one **as a whole file** — pick a file on the left, edit its full JSON on the right, save it straight back to disk. Create and delete files from the UI. Each file shows a valid/invalid indicator and size. Path traversal is blocked; saves are atomic.
- The editor now opens at **full height** by default — no scrolling to grow it; only the editor scrolls internally.

### Fixed
- **White area on scroll:** the dashboard shell now uses a fixed-height layout where only the content column scrolls, so scrolling a tall page no longer reveals a blank/white strip below the content.

### Changed
- Motion pass per the design skills: faster, lighter entrances (~280ms, ease-out-expo), live status pulse, removed the toast's side-stripe accent, smoother modal/toast exits. All motion still respects `prefers-reduced-motion`.

## 0.0.6

### Fixed
- **IP allowlist lockout (critical):** saving an allowlist that didn't include your own IP locked you out of the dashboard entirely (every request, including the page itself, returned `403`). Localhost is now always allowed, and your current IP is auto-added to any allowlist you save. The blocklist can no longer contain localhost or your own IP.

### Added — Dashboard
- **Raw JSON editor:** edit the whole database directly as JSON in a code editor with line numbers and syntax highlighting (format / validate / save). The previous per-key card editor remains available via a Raw / Cards toggle.
- **CSRF protection:** every authenticated state-changing request now requires a per-session `X-CSRF-Token`.
- **Honeypot traps:** common attack paths (`/wp-login.php`, `/.env`, `/phpmyadmin`, …) and a hidden login form field are watched; hits are logged and rejected.
- **Access & security log:** records logins, failed attempts, locked-out and blocked IPs, honeypot hits, settings/data changes, and imports — with timestamp, IP, and user-agent. Viewable in Settings → Security, persisted to `ekmek-dashboard.log.json`.
- **Animated UI:** staggered card entrances, view transitions, a count-up stat, and subtle micro-interactions, all disabled under `prefers-reduced-motion`.

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
