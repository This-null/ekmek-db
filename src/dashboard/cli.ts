#!/usr/bin/env node
import { EkmekDB } from '../core/EkmekDB';
import { JsonAdapter } from '../adapters/JsonAdapter';
import { Dashboard } from './Dashboard';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

async function main() {
  const [, , command, ...rest] = process.argv;
  if (command && command !== 'dashboard') {
    console.log('Usage: ekmek-db dashboard [--port 8080] [--host 0.0.0.0] [--folder data] [--file db.json]');
    process.exit(command === 'help' || command === '--help' ? 0 : 1);
  }

  const args = parseArgs(rest);
  const db = new EkmekDB(
    new JsonAdapter({ folder: args.folder || 'data', file: args.file || 'db.json' })
  );

  const dashboard = new Dashboard(db, {
    port: args.port ? Number(args.port) : undefined,
    host: args.host,
    configPath: args.config,
  });

  await dashboard.start();

  const shutdown = async () => {
    await dashboard.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[ekmek-db] dashboard failed to start:', err.message);
  process.exit(1);
});
