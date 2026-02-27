import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  BrowserActionError,
  BrowserMode,
  BrowserRuntimeState,
  BrowserSessionStatus,
} from './types.js';

export const BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH = join(
  '.opta',
  'browser',
  'runtime-sessions.json',
);

export interface BrowserRuntimeSessionRecord {
  sessionId: string;
  mode: BrowserMode;
  status: BrowserSessionStatus;
  runtime: BrowserRuntimeState;
  createdAt: string;
  updatedAt: string;
  currentUrl?: string;
  wsEndpoint?: string;
  lastError?: BrowserActionError;
  recoveredAt?: string;
}

export interface BrowserRuntimeSessionStoreData {
  schemaVersion: 1;
  updatedAt: string;
  sessions: BrowserRuntimeSessionRecord[];
}

const EMPTY_DATA: BrowserRuntimeSessionStoreData = {
  schemaVersion: 1,
  updatedAt: new Date(0).toISOString(),
  sessions: [],
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sanitizeData(input: unknown): BrowserRuntimeSessionStoreData {
  if (
    input === null
    || input === undefined
    || typeof input !== 'object'
    || Array.isArray(input)
  ) {
    return { ...EMPTY_DATA };
  }

  const root = input as Partial<BrowserRuntimeSessionStoreData>;
  const sessions = Array.isArray(root.sessions)
    ? root.sessions.filter((item): item is BrowserRuntimeSessionRecord => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<BrowserRuntimeSessionRecord>;
      return (
        typeof candidate.sessionId === 'string'
        && (candidate.mode === 'isolated' || candidate.mode === 'attach')
        && (candidate.status === 'open' || candidate.status === 'closed')
        && (candidate.runtime === 'playwright' || candidate.runtime === 'unavailable')
        && typeof candidate.createdAt === 'string'
        && typeof candidate.updatedAt === 'string'
      );
    })
    : [];

  return {
    schemaVersion: 1,
    updatedAt: typeof root.updatedAt === 'string' ? root.updatedAt : new Date(0).toISOString(),
    sessions,
  };
}

export function browserRuntimeSessionStorePath(cwd: string): string {
  return join(cwd, BROWSER_RUNTIME_SESSION_STORE_RELATIVE_PATH);
}

export class BrowserSessionStore {
  private readonly cwd: string;
  private readonly now: () => Date;

  constructor(options: { cwd?: string; now?: () => Date } = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.now = options.now ?? (() => new Date());
  }

  get path(): string {
    return browserRuntimeSessionStorePath(this.cwd);
  }

  async read(): Promise<BrowserRuntimeSessionStoreData> {
    try {
      const raw = await readFile(this.path, 'utf-8');
      try {
        const parsed = JSON.parse(raw) as unknown;
        return sanitizeData(parsed);
      } catch (error) {
        if (process.env.OPTA_DEBUG) {
          console.error(
            `Failed to parse browser runtime session store at ${this.path}; resetting store.`,
            error,
          );
        }
        return { ...EMPTY_DATA };
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') return { ...EMPTY_DATA };
      throw new Error(`Failed to read browser runtime session store: ${toErrorMessage(error)}`);
    }
  }

  async write(data: BrowserRuntimeSessionStoreData): Promise<void> {
    const dir = dirname(this.path);
    await mkdir(dir, { recursive: true });

    const normalized = sanitizeData(data);
    const nextData: BrowserRuntimeSessionStoreData = {
      ...normalized,
      updatedAt: this.now().toISOString(),
    };

    const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, JSON.stringify(nextData, null, 2) + '\n', 'utf-8');
    try {
      await rename(tempPath, this.path);
    } finally {
      await unlink(tempPath).catch(() => {});
    }
  }

  async list(): Promise<BrowserRuntimeSessionRecord[]> {
    const data = await this.read();
    return [...data.sessions];
  }

  async replaceSessions(sessions: BrowserRuntimeSessionRecord[]): Promise<void> {
    await this.write({
      schemaVersion: 1,
      updatedAt: this.now().toISOString(),
      sessions: [...sessions],
    });
  }
}
