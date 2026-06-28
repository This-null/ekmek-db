import fs from 'fs';
import path from 'path';
import { EkmekDB } from '../core/EkmekDB';
import { ConfigStore } from './server/config';
import { DashboardServer, resolvePublicDir } from './server/Server';

export interface DashboardOptions {
  port?: number;
  host?: string;
  configPath?: string;
  dbName?: string;
  quiet?: boolean;
}

function readVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export class Dashboard {
  private store: ConfigStore;
  private server: DashboardServer | null = null;
  private readonly options: DashboardOptions;
  private readonly configFile: string;

  constructor(private db: EkmekDB, options: DashboardOptions = {}) {
    this.options = options;
    this.configFile = options.configPath ?? path.join(process.cwd(), 'ekmek-dashboard.config.json');
    this.store = new ConfigStore(this.configFile);
  }

  async start(): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (this.options.port !== undefined) patch.port = this.options.port;
    if (this.options.host !== undefined) patch.host = this.options.host;
    if (Object.keys(patch).length > 0) await this.store.update(patch);

    const logPath = path.join(path.dirname(this.configFile), 'ekmek-dashboard.log.json');

    this.server = new DashboardServer({
      store: this.store,
      db: this.db,
      appVersion: readVersion(),
      dbName: this.options.dbName ?? 'ekmek-db',
      publicDir: resolvePublicDir(),
      logPath,
      quiet: this.options.quiet,
    });
    await this.server.start();
  }

  async stop(): Promise<void> {
    if (this.server) await this.server.stop();
    this.server = null;
  }

  get configPath(): string {
    return this.store.filePath;
  }
}
