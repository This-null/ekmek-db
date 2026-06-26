import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'dashboard', 'public');
const dest = join(root, 'dist', 'dashboard', 'public');

if (!existsSync(src)) {
  console.error('[copy-public] source not found:', src);
  process.exit(1);
}

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log('[copy-public] dashboard assets copied -> dist/dashboard/public');
