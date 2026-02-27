import { nanoid } from 'nanoid';

export interface PermissionRequestRecord {
  requestId: string;
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
  createdAt: string;
}

interface PendingPermission extends PermissionRequestRecord {
  resolved: boolean;
  resolve: (decision: 'allow' | 'deny') => void;
  timeout: NodeJS.Timeout;
}

export interface PermissionResolutionResult {
  ok: boolean;
  conflict: boolean;
  message?: string;
}

export class PermissionCoordinator {
  private readonly pending = new Map<string, PendingPermission>();
  private readonly recentlyResolved = new Map<string, number>();

  constructor(private readonly timeoutMs = 120_000) {}

  request(
    sessionId: string,
    toolName: string,
    args: Record<string, unknown>
  ): { request: PermissionRequestRecord; decision: Promise<'allow' | 'deny'> } {
    const requestId = `perm_${nanoid(10)}`;
    const request: PermissionRequestRecord = {
      requestId,
      sessionId,
      toolName,
      args,
      createdAt: new Date().toISOString(),
    };

    const decision = new Promise<'allow' | 'deny'>((resolve) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(requestId);
        if (!pending || pending.resolved) return;
        pending.resolved = true;
        this.pending.delete(requestId);
        resolve('deny');
      }, this.timeoutMs);
      timeout.unref();

      this.pending.set(requestId, {
        ...request,
        resolved: false,
        resolve,
        timeout,
      });
    });

    return { request, decision };
  }

  resolve(requestId: string, decision: 'allow' | 'deny'): PermissionResolutionResult {
    const pending = this.pending.get(requestId);
    if (!pending) {
      if (this.recentlyResolved.has(requestId)) {
        return { ok: false, conflict: true, message: 'Permission request already resolved' };
      }
      return { ok: false, conflict: false, message: 'Unknown permission request' };
    }
    if (pending.resolved) {
      return { ok: false, conflict: true, message: 'Permission request already resolved' };
    }

    pending.resolved = true;
    clearTimeout(pending.timeout);
    this.pending.delete(requestId);
    this.recentlyResolved.set(requestId, Date.now());
    const gc = setTimeout(() => {
      this.recentlyResolved.delete(requestId);
    }, this.timeoutMs);
    gc.unref();
    pending.resolve(decision);
    return { ok: true, conflict: false };
  }

  has(requestId: string): boolean {
    return this.pending.has(requestId);
  }
}
