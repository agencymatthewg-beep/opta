/**
 * Branch management layer on top of chat-store.
 *
 * Extends sessions with parent/branch metadata to support "fork chat"
 * functionality. Uses the same IndexedDB store and key prefix as chat-store,
 * just adds optional metadata fields. Does NOT modify the Session type in
 * types/lmx.ts — the extended type is local to this module.
 */

import { get, set, keys } from 'idb-keyval';
import type { Session, ChatMessage } from '@/types/lmx';
import { generateSessionTitle } from '@/lib/chat-store';

const SESSION_PREFIX = 'opta-session:';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Session with optional branching metadata. */
export interface BranchableSession extends Session {
  /** ID of the parent session this branch was forked from. */
  parentId?: string;
  /** Message index in the parent where this branch was created. */
  branchPoint?: number;
  /** User-assigned label for this branch. */
  branchLabel?: string;
}

/** Recursive tree node for branch visualization. */
export interface BranchNode {
  id: string;
  title: string;
  messageCount: number;
  branchPoint: number;
  children: BranchNode[];
}

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

/**
 * Fork a session at the given message index.
 *
 * Creates a new session with messages[0..atMessageIndex] (inclusive),
 * sets parentId and branchPoint, and persists it to IndexedDB.
 *
 * @returns The newly created branch session.
 */
export async function forkSession(
  sessionId: string,
  atMessageIndex: number,
): Promise<BranchableSession> {
  const parent = await get<BranchableSession>(
    `${SESSION_PREFIX}${sessionId}`,
  );

  if (!parent) {
    throw new Error(`Session "${sessionId}" not found`);
  }

  if (atMessageIndex < 0 || atMessageIndex >= parent.messages.length) {
    throw new Error(
      `Message index ${atMessageIndex} out of range (0–${parent.messages.length - 1})`,
    );
  }

  // Copy messages up to and including atMessageIndex
  const forkedMessages: ChatMessage[] = parent.messages
    .slice(0, atMessageIndex + 1)
    .map((msg) => ({ ...msg }));

  const now = new Date().toISOString();
  const branchSession: BranchableSession = {
    id: crypto.randomUUID(),
    title: generateSessionTitle(forkedMessages),
    messages: forkedMessages,
    model: parent.model,
    created_at: now,
    updated_at: now,
    parentId: sessionId,
    branchPoint: atMessageIndex,
  };

  await set(`${SESSION_PREFIX}${branchSession.id}`, branchSession);

  return branchSession;
}

/**
 * Get all direct branches (children) of a session.
 *
 * @returns Array of sessions whose parentId matches the given session ID,
 * sorted by created_at ascending.
 */
export async function getBranches(
  sessionId: string,
): Promise<BranchableSession[]> {
  const allKeys = await keys();
  const sessionKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(SESSION_PREFIX),
  );

  const branches: BranchableSession[] = [];
  for (const key of sessionKeys) {
    const session = await get<BranchableSession>(key as string);
    if (session?.parentId === sessionId) {
      branches.push(session);
    }
  }

  return branches.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/**
 * Build a recursive tree structure from a root session.
 *
 * Walks down from the given session ID, collecting all descendants into
 * a tree of BranchNode objects.
 */
export async function getBranchTree(
  sessionId: string,
): Promise<BranchNode[]> {
  const session = await get<BranchableSession>(
    `${SESSION_PREFIX}${sessionId}`,
  );

  if (!session) return [];

  // Find the true root: walk up the parent chain
  let rootId = sessionId;
  let current = session;
  while (current.parentId) {
    rootId = current.parentId;
    const parent = await get<BranchableSession>(
      `${SESSION_PREFIX}${current.parentId}`,
    );
    if (!parent) break;
    current = parent;
  }

  // Build tree from root
  return buildChildNodes(rootId);
}

/**
 * Recursively build child nodes for a given session.
 */
async function buildChildNodes(sessionId: string): Promise<BranchNode[]> {
  const children = await getBranches(sessionId);

  const nodes: BranchNode[] = [];
  for (const child of children) {
    const grandchildren = await buildChildNodes(child.id);
    nodes.push({
      id: child.id,
      title: child.title,
      messageCount: child.messages.length,
      branchPoint: child.branchPoint ?? 0,
      children: grandchildren,
    });
  }

  return nodes;
}

/**
 * Rename a branch (set its label).
 */
export async function renameBranch(
  sessionId: string,
  label: string,
): Promise<void> {
  const session = await get<BranchableSession>(
    `${SESSION_PREFIX}${sessionId}`,
  );

  if (!session) {
    throw new Error(`Session "${sessionId}" not found`);
  }

  session.branchLabel = label;
  session.updated_at = new Date().toISOString();
  await set(`${SESSION_PREFIX}${sessionId}`, session);
}

/**
 * Get a session with branch metadata.
 */
export async function getBranchableSession(
  sessionId: string,
): Promise<BranchableSession | undefined> {
  return get<BranchableSession>(`${SESSION_PREFIX}${sessionId}`);
}
