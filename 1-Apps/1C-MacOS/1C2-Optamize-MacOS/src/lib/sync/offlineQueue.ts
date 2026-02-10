/**
 * Offline-First Queue with Optimistic Updates
 *
 * Provides a queue system for operations that need to sync
 * when connectivity is restored, with optimistic UI updates.
 */

// Offline queue manages its own persistence via localStorage

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  recordId: string;
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

export interface OptimisticUpdate<T> {
  id: string;
  originalValue: T | null;
  optimisticValue: T;
  rollback: () => void;
}

type OperationHandler = (operation: QueuedOperation) => Promise<boolean>;

class OfflineQueue {
  private queue: Map<string, QueuedOperation> = new Map();
  private handlers: Map<string, OperationHandler> = new Map();
  private optimisticUpdates: Map<string, OptimisticUpdate<unknown>> = new Map();
  private isOnline = navigator.onLine;
  private processing = false;
  private listeners: Set<(event: QueueEvent) => void> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Load persisted queue
    this.loadQueue();
  }

  /**
   * Register a handler for a specific operation type
   */
  registerHandler(table: string, handler: OperationHandler): void {
    this.handlers.set(table, handler);
  }

  /**
   * Subscribe to queue events
   */
  onEvent(callback: (event: QueueEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: QueueEvent): void {
    this.listeners.forEach(cb => cb(event));
  }

  /**
   * Add an operation to the queue with optimistic update
   */
  async enqueue<T>(
    type: QueuedOperation['type'],
    table: string,
    recordId: string,
    data: Record<string, unknown>,
    options?: {
      originalValue?: T;
      optimisticValue?: T;
      maxRetries?: number;
    }
  ): Promise<string> {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const operation: QueuedOperation = {
      id,
      type,
      table,
      recordId,
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: options?.maxRetries || 3,
      status: 'pending',
    };

    this.queue.set(id, operation);
    await this.persistQueue();

    // Track optimistic update if provided
    if (options?.optimisticValue !== undefined) {
      const update: OptimisticUpdate<T> = {
        id,
        originalValue: options.originalValue || null,
        optimisticValue: options.optimisticValue,
        rollback: () => {
          // Rollback logic will be implemented by the caller
        },
      };
      this.optimisticUpdates.set(id, update as OptimisticUpdate<unknown>);
    }

    this.emit({ type: 'operation_queued', operation });

    // Process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process the queue
   */
  async processQueue(): Promise<void> {
    if (this.processing || !this.isOnline) return;

    this.processing = true;
    this.emit({ type: 'processing_started' });

    const pendingOps = Array.from(this.queue.values())
      .filter(op => op.status === 'pending')
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const operation of pendingOps) {
      await this.processOperation(operation);
    }

    this.processing = false;
    this.emit({ type: 'processing_completed' });
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<boolean> {
    const handler = this.handlers.get(operation.table);
    if (!handler) {
      console.error(`No handler registered for table: ${operation.table}`);
      return false;
    }

    operation.status = 'processing';
    this.emit({ type: 'operation_processing', operationId: operation.id });

    try {
      const success = await handler(operation);

      if (success) {
        operation.status = 'completed';
        this.queue.delete(operation.id);
        this.optimisticUpdates.delete(operation.id);
        await this.persistQueue();
        this.emit({ type: 'operation_completed', operationId: operation.id });
        return true;
      } else {
        throw new Error('Handler returned false');
      }
    } catch (err) {
      operation.retries++;
      if (operation.retries >= operation.maxRetries) {
        operation.status = 'failed';
        this.emit({ type: 'operation_failed', operationId: operation.id, error: err });

        // Rollback optimistic update
        const update = this.optimisticUpdates.get(operation.id);
        if (update) {
          update.rollback();
          this.optimisticUpdates.delete(operation.id);
        }
      } else {
        operation.status = 'pending';
        this.emit({ type: 'operation_retry', operationId: operation.id, attempt: operation.retries });
      }

      await this.persistQueue();
      return false;
    }
  }

  /**
   * Cancel an operation
   */
  async cancel(operationId: string): Promise<boolean> {
    const operation = this.queue.get(operationId);
    if (!operation || operation.status === 'processing') return false;

    this.queue.delete(operationId);

    // Rollback optimistic update
    const update = this.optimisticUpdates.get(operationId);
    if (update) {
      update.rollback();
      this.optimisticUpdates.delete(operationId);
    }

    await this.persistQueue();
    this.emit({ type: 'operation_cancelled', operationId });
    return true;
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    const operations = Array.from(this.queue.values());
    return {
      total: operations.length,
      pending: operations.filter(op => op.status === 'pending').length,
      processing: operations.filter(op => op.status === 'processing').length,
      failed: operations.filter(op => op.status === 'failed').length,
      isOnline: this.isOnline,
      isProcessing: this.processing,
    };
  }

  /**
   * Get failed operations
   */
  getFailedOperations(): QueuedOperation[] {
    return Array.from(this.queue.values()).filter(op => op.status === 'failed');
  }

  /**
   * Retry failed operations
   */
  async retryFailed(): Promise<void> {
    const failed = this.getFailedOperations();
    for (const op of failed) {
      op.status = 'pending';
      op.retries = 0;
    }
    await this.persistQueue();
    await this.processQueue();
  }

  /**
   * Clear failed operations
   */
  async clearFailed(): Promise<void> {
    const failed = this.getFailedOperations();
    for (const op of failed) {
      this.queue.delete(op.id);
      const update = this.optimisticUpdates.get(op.id);
      if (update) {
        update.rollback();
        this.optimisticUpdates.delete(op.id);
      }
    }
    await this.persistQueue();
  }

  /**
   * Handle coming online
   */
  private handleOnline(): void {
    this.isOnline = true;
    this.emit({ type: 'online' });
    this.processQueue();
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOnline = false;
    this.emit({ type: 'offline' });
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(): Promise<void> {
    try {
      const data = Array.from(this.queue.values());
      localStorage.setItem('opta_offline_queue', JSON.stringify(data));
    } catch (err) {
      console.error('Failed to persist queue:', err);
    }
  }

  /**
   * Load queue from storage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem('opta_offline_queue');
      if (stored) {
        const data = JSON.parse(stored) as QueuedOperation[];
        for (const op of data) {
          // Reset processing operations to pending
          if (op.status === 'processing') {
            op.status = 'pending';
          }
          this.queue.set(op.id, op);
        }
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  }
}

// Status type
export interface QueueStatus {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  isOnline: boolean;
  isProcessing: boolean;
}

// Event types
export type QueueEvent =
  | { type: 'online' }
  | { type: 'offline' }
  | { type: 'operation_queued'; operation: QueuedOperation }
  | { type: 'operation_processing'; operationId: string }
  | { type: 'operation_completed'; operationId: string }
  | { type: 'operation_failed'; operationId: string; error: unknown }
  | { type: 'operation_retry'; operationId: string; attempt: number }
  | { type: 'operation_cancelled'; operationId: string }
  | { type: 'processing_started' }
  | { type: 'processing_completed' };

// Export singleton instance
export const offlineQueue = new OfflineQueue();
