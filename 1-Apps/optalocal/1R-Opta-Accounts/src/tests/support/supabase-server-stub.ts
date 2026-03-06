import { randomUUID } from 'node:crypto';
import {
  findMockDevice,
  findMockSyncFile,
  getMockUser,
  listMockSyncFiles,
  upsertMockSyncFile,
  type MockSyncFileRecord,
} from './route-mocks.ts';

type QueryFilters = Map<string, unknown>;

function buildDeviceQueryBuilder() {
  const filters: QueryFilters = new Map<string, unknown>();

  const builder = {
    select(_columns: string) {
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.set(column, value);
      return builder;
    },
    async maybeSingle() {
      const id = filters.get('id');
      const userId = filters.get('user_id');
      if (typeof id !== 'string' || typeof userId !== 'string') {
        return { data: null, error: null };
      }

      const device = findMockDevice(id, userId);
      if (!device) return { data: null, error: null };

      return {
        data: {
          id: device.id,
          trust_state: device.trustState,
          device_label: device.deviceLabel ?? null,
        },
        error: null,
      };
    },
    async single() {
      const result = await builder.maybeSingle();
      if (result.data) return result;
      return {
        data: null,
        error: { message: 'not_found' },
      };
    },
  };

  return builder;
}

function buildFallbackQueryBuilder() {
  const builder = {
    select(_columns: string) {
      return builder;
    },
    eq(_column: string, _value: unknown) {
      return builder;
    },
    async maybeSingle() {
      return { data: null, error: null };
    },
    async single() {
      return { data: null, error: { message: 'not_found' } };
    },
  };

  return builder;
}

function buildSyncFilesQueryBuilder() {
  const filters: QueryFilters = new Map<string, unknown>();
  const gtFilters: QueryFilters = new Map<string, unknown>();
  let limitValue: number | null = null;
  let upsertPayload: Record<string, unknown> | null = null;

  function getListResult() {
    const userId = filters.get('user_id') as string | undefined;
    if (!userId) return { data: [] as MockSyncFileRecord[], error: null };
    const cutoff = gtFilters.get('updated_at') as string | undefined;
    let rows = listMockSyncFiles(userId).filter((r) => r.is_active);
    if (cutoff) rows = rows.filter((r) => r.updated_at > cutoff);
    rows = rows.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    if (limitValue !== null) rows = rows.slice(0, limitValue);
    return { data: rows, error: null };
  }

  const builder = {
    select(_columns: string) {
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.set(column, value);
      return builder;
    },
    gt(column: string, value: unknown) {
      gtFilters.set(column, value);
      return builder;
    },
    order(_column: string, _opts?: unknown) {
      return builder;
    },
    limit(n: number) {
      limitValue = n;
      return builder;
    },
    upsert(payload: Record<string, unknown>, _opts?: unknown) {
      upsertPayload = payload;
      return builder;
    },
    async maybeSingle(): Promise<{ data: MockSyncFileRecord | null; error: null }> {
      const userId = filters.get('user_id') as string | undefined;
      const filename = filters.get('filename') as string | undefined;
      if (!userId) return { data: null, error: null };
      if (filename) return { data: findMockSyncFile(userId, filename), error: null };
      const all = listMockSyncFiles(userId);
      return { data: all[0] ?? null, error: null };
    },
    async single(): Promise<{ data: MockSyncFileRecord | null; error: { message: string } | null }> {
      if (upsertPayload) {
        const userId = upsertPayload['user_id'] as string;
        const filename = upsertPayload['filename'] as string;
        const content = upsertPayload['content'] as string;
        const existing = findMockSyncFile(userId, filename);
        const now = new Date().toISOString();
        const record: MockSyncFileRecord = {
          id: existing?.id ?? randomUUID(),
          userId,
          filename,
          content,
          is_active: true,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        };
        upsertMockSyncFile(record);
        return { data: record, error: null };
      }
      const result = await builder.maybeSingle();
      if (result.data) return { data: result.data, error: null };
      return { data: null, error: { message: 'not_found' } };
    },
    then<TResult1 = { data: MockSyncFileRecord[]; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: MockSyncFileRecord[]; error: null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve(getListResult()).then(
        onfulfilled,
        onrejected as ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
      ) as Promise<TResult1 | TResult2>;
    },
  };

  return builder;
}

export async function createClient() {
  return {
    auth: {
      async getUser() {
        const userId = getMockUser();
        return {
          data: {
            user: userId ? { id: userId } : null,
          },
        };
      },
    },
    from(table: string) {
      if (table === 'accounts_devices') {
        return buildDeviceQueryBuilder();
      }
      if (table === 'sync_files') {
        return buildSyncFilesQueryBuilder();
      }
      return buildFallbackQueryBuilder();
    },
  };
}
