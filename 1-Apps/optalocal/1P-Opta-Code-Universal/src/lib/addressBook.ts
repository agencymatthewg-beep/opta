/**
 * addressBook.ts
 *
 * Persists a list of named daemon connection targets to localStorage.
 * Tokens are stored separately via Tauri keychain when available (native),
 * or inside the localStorage entry itself (web fallback).
 */

import type { DaemonConnectionOptions } from "../types";
import { getTauriInvoke, isNativeDesktop } from "./runtime";

export const ADDRESS_BOOK_KEY = "opta:connection-addressbook";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressBookEntry {
    id: string;
    label: string;
    host: string;
    port: number;
    protocol?: "http" | "https";
    /** ISO timestamp of last successful probe */
    lastSeen?: string;
    /** Last measured latency in ms */
    latencyMs?: number;
    /** Token stored in localStorage (web fallback — not used on native) */
    _webToken?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function isValidEntry(raw: unknown): raw is AddressBookEntry {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const e = raw as Record<string, unknown>;
    return (
        typeof e.id === "string" &&
        typeof e.label === "string" &&
        typeof e.host === "string" &&
        typeof e.port === "number"
    );
}

// ─── Pinned local entry ────────────────────────────────────────────────────────

export const LOCAL_DAEMON_ENTRY: AddressBookEntry = {
    id: "__local__",
    label: "Local Daemon",
    host: "127.0.0.1",
    port: 9999,
    protocol: "http",
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function loadAddressBook(): AddressBookEntry[] {
    try {
        const raw = localStorage.getItem(ADDRESS_BOOK_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown[];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidEntry);
    } catch {
        return [];
    }
}

export function saveAddressBook(entries: AddressBookEntry[]): void {
    try {
        localStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(entries));
    } catch {
        // ignore quota errors
    }
}

export function addEntry(
    entries: AddressBookEntry[],
    partial: Omit<AddressBookEntry, "id">,
): AddressBookEntry[] {
    const next: AddressBookEntry = { ...partial, id: generateId() };
    return [...entries, next];
}

export function updateEntry(
    entries: AddressBookEntry[],
    id: string,
    patch: Partial<Omit<AddressBookEntry, "id">>,
): AddressBookEntry[] {
    return entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
}

export function removeEntry(
    entries: AddressBookEntry[],
    id: string,
): AddressBookEntry[] {
    return entries.filter((e) => e.id !== id);
}

// ─── Token persistence ────────────────────────────────────────────────────────

export async function loadTokenForEntry(
    entry: AddressBookEntry,
): Promise<string> {
    if (isNativeDesktop()) {
        const invoke = getTauriInvoke();
        if (invoke) {
            try {
                const result = await invoke("get_connection_secret", {
                    host: entry.host,
                    port: entry.port,
                });
                if (typeof result === "string") return result;
            } catch {
                // fall through to web fallback
            }
        }
    }
    return entry._webToken ?? "";
}

export async function saveTokenForEntry(
    entry: AddressBookEntry,
    token: string,
    entries: AddressBookEntry[],
): Promise<AddressBookEntry[]> {
    if (isNativeDesktop()) {
        const invoke = getTauriInvoke();
        if (invoke) {
            try {
                await invoke("set_connection_secret", {
                    host: entry.host,
                    port: entry.port,
                    token,
                });
                return entries;
            } catch {
                // fall through to web fallback
            }
        }
    }
    // Web fallback: store token inside the entry itself
    return updateEntry(entries, entry.id, { _webToken: token });
}

// ─── Connection ↔ Entry interop ────────────────────────────────────────────────

export async function entryToConnection(
    entry: AddressBookEntry,
): Promise<DaemonConnectionOptions> {
    const token = await loadTokenForEntry(entry);
    return {
        host: entry.host,
        port: entry.port,
        protocol: entry.protocol,
        token,
    };
}

export function connectionToEntry(
    conn: DaemonConnectionOptions,
    label: string,
): Omit<AddressBookEntry, "id"> {
    return {
        label,
        host: conn.host,
        port: conn.port,
        protocol: conn.protocol,
    };
}
