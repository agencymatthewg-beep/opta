import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import type { AccountState } from '../accounts/types.js';
import { resolveSupabaseAuthConfig } from '../accounts/supabase.js';
import { InlineSelect, InlineSlider, type SelectOption } from './InlineSelect.js';
import { OPTA_BRAND_GLYPH, OPTA_BRAND_NAME } from '../ui/brand.js';
import { errorMessage } from '../utils/errors.js';

// --- TYPES ---

type SettingsPageId = 'connection' | 'models' | 'safety' | 'paths' | 'advanced' | 'atpo' | 'account';
type SettingsDisplayProfile = 'compact' | 'opta' | 'advanced';

interface SettingsPage { id: SettingsPageId; label: string; color: string; }

interface SettingsItem {
  label: string;
  description: string;
  configKey: string;
  defaultValue: string;
  sensitive?: boolean;      // Mask displayed value with ●●●●●
  /** Validates the typed value; returns an error message string, or null when valid. */
  validate?: (v: string) => string | null;
  hint?: string;            // Extra help text shown below the input field
  /** Input type: 'text' (default), 'select' for fixed options, 'toggle' for bool, 'slider' for range, 'action' for one-shot callbacks */
  inputType?: 'text' | 'select' | 'toggle' | 'slider' | 'action';
  /** Options for select-type items */
  options?: SelectOption[];
  /** Range bounds for slider-type items */
  min?: number;
  max?: number;
  /** Descriptions per slider value */
  sliderLabels?: Record<number, string>;
  /** Callback for 'action' items — invoked on Enter/Space */
  action?: () => void | Promise<void>;
}

export interface SettingsOverlayProps {
  /** Current phase of the open/close animation. Defaults to `'open'`. */
  animationPhase?: 'opening' | 'open' | 'closing';
  /** Normalized progress of the animation (0–1). Defaults to `1` (fully open). */
  animationProgress?: number;
  /** Maximum terminal columns the overlay may occupy. */
  maxWidth?: number;
  /** Maximum terminal rows the overlay may occupy. */
  maxHeight?: number;
  /** Flat dot-notation config snapshot (e.g. `{ 'connection.host': 'localhost' }`). */
  config?: Record<string, unknown>;
  onClose: () => void;
  onSave: (changes: Record<string, unknown>) => void;
}

// --- CONSTANTS ---

const PAGES: SettingsPage[] = [
  { id: 'connection', label: 'Connection',  color: '#10b981' },
  { id: 'models',     label: 'Models',      color: '#a78bfa' },
  { id: 'safety',     label: 'Safety',      color: '#f59e0b' },
  { id: 'paths',      label: 'Paths',       color: '#38bdf8' },
  { id: 'advanced',   label: 'Advanced',    color: '#22d3ee' },
  { id: 'atpo',       label: 'Atpo',        color: '#c084fc' },
  { id: 'account',    label: 'Account',     color: '#f472b6' },
];

const PAGE_INDEX = PAGES.reduce<Record<SettingsPageId, number>>(
  (acc, p, i) => { acc[p.id] = i; return acc; },
  {} as Record<SettingsPageId, number>
);

/** Ordered cycle of display profiles (Shift+Tab advances through this list). */
const SETTINGS_DISPLAY_PROFILES: SettingsDisplayProfile[] = ['compact', 'opta', 'advanced'];
const SETTINGS_DISPLAY_PROFILE_LABEL: Record<SettingsDisplayProfile, string> = {
  compact: 'Compact',
  opta: 'Opta',
  advanced: 'Advanced',
};
const COMPACT_PROFILE_KEYS = new Set<string>([
  'connection.host',
  'connection.port',
  'model.default',
  'provider.active',
  'autonomy.level',
  'defaultMode',
  'journal.sessionLogsDir',
  'browser.enabled',
  'research.defaultProvider',
]);
const ADVANCED_PROFILE_ONLY_KEYS = new Set<string>([
  'connection.fallbackHosts',
  'connection.ssh.lmxPath',
  'connection.inferenceTimeout',
  'safety.circuitBreaker.pauseAt',
  'safety.circuitBreaker.hardStopAt',
  'safety.compactAt',
  'learning.ledgerPath',
  'policy.audit.path',
  'browser.runtime.maxSessions',
  'search.searxngUrl',
  'research.providers.brave.apiKey',
  'research.providers.exa.apiKey',
  'research.providers.tavily.apiKey',
  'research.providers.gemini.apiKey',
]);

/** Platform-specific command used to open a URL in the default browser. */
const BROWSER_OPEN_CMD: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'open',
  win32: 'start',
};

/** Opens a URL in the OS default browser (cross-platform, fire-and-forget). */
function openInBrowser(url: string): void {
  const cmd = BROWSER_OPEN_CMD[process.platform] ?? 'xdg-open';
  import('node:child_process').then(({ spawn }) => {
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  }).catch(() => {
    // Best-effort: silently ignore failures (user may open the URL manually).
  });
}

const PAGE_ITEMS: Record<SettingsPageId, SettingsItem[]> = {
  connection: [
    { label: 'LMX Host',            configKey: 'connection.host',              defaultValue: 'localhost',           description: 'Hostname or IP of LMX inference server',                  hint: 'e.g. 192.168.188.11 or localhost' },
    { label: 'LMX Port',            configKey: 'connection.port',              defaultValue: '1234',                description: 'Port number for LMX API',                                  hint: 'Default: 1234' },
    { label: 'LMX API Key',         configKey: 'connection.apiKey',            defaultValue: 'opta-lmx',            description: 'API key for LMX (if auth enabled)', sensitive: true,      hint: 'Default: opta-lmx (no auth)' },
    { label: 'Fallback Hosts',      configKey: 'connection.fallbackHosts',     defaultValue: '',                    description: 'Comma-separated fallback LMX hosts',                       hint: 'e.g. 10.0.0.2:1234,10.0.0.3:1234' },
    { label: 'SSH User',            configKey: 'connection.ssh.user',          defaultValue: 'opta',                description: 'SSH username for remote LMX server',                       hint: 'User on the Mac Studio' },
    { label: 'SSH Key Path',        configKey: 'connection.ssh.identityFile',  defaultValue: '~/.ssh/id_ed25519',   description: 'Path to SSH private key',                                  hint: 'Full path or ~ expansion' },
    { label: 'Remote LMX Path',     configKey: 'connection.ssh.lmxPath',       defaultValue: '~/opta-lmx', description: 'LMX install path on remote host (git clone or pip install dir)', hint: 'Absolute path on remote machine' },
    { label: 'Inference Timeout',   configKey: 'connection.inferenceTimeout',  defaultValue: '120000',              description: 'Max ms to wait for model response',                        hint: 'In milliseconds (120000 = 2 min)' },
  ],
  models: [
    { label: 'Default Model',       configKey: 'model.default',                defaultValue: '',                    description: 'Model loaded by default in new sessions',                  hint: 'Run: opta models list' },
    { label: 'Context Limit',       configKey: 'model.contextLimit',           defaultValue: '32768',               description: 'Token context window override',                            hint: 'Tokens (default: 32768)' },
    { label: 'Active Provider',     configKey: 'provider.active',              defaultValue: 'lmx',                 description: 'Primary provider: lmx or anthropic',
      inputType: 'select', options: [
        { label: 'LMX (local)',    value: 'lmx',       description: 'Local inference via Mac Studio' },
        { label: 'Anthropic (cloud)', value: 'anthropic', description: 'Cloud API via Anthropic' },
      ],
    },
    { label: 'Anthropic Key',       configKey: 'provider.anthropic.apiKey',    defaultValue: '', sensitive: true,    description: 'Anthropic API key for cloud fallback',                     hint: 'console.anthropic.com' },
    { label: 'Anthropic Model',     configKey: 'provider.anthropic.model',     defaultValue: 'claude-sonnet-4-5-20250929', description: 'Anthropic model for fallback',
      inputType: 'select', options: [
        { label: 'Claude Opus 4.6',    value: 'claude-opus-4-6',              description: 'Most capable, slower' },
        { label: 'Claude Sonnet 4.6',  value: 'claude-sonnet-4-6',            description: 'Balanced speed/quality' },
        { label: 'Claude Sonnet 4.5',  value: 'claude-sonnet-4-5-20250929',   description: 'Previous generation' },
        { label: 'Claude Haiku 4.5',   value: 'claude-haiku-4-5-20251001',    description: 'Fast, lightweight' },
      ],
    },
    { label: 'Fallback on Failure', configKey: 'provider.fallbackOnFailure',   defaultValue: 'false',               description: 'Auto-fallback to Anthropic if LMX fails',
      inputType: 'toggle', options: [
        { label: 'Enabled',  value: 'true',  description: 'Auto-switch to Anthropic when LMX fails' },
        { label: 'Disabled', value: 'false', description: 'Stay on LMX even if it fails' },
      ],
    },
    { label: 'Embedding Model',     configKey: 'model.embeddingModel',         defaultValue: '',                    description: 'HuggingFace model ID for LMX embeddings',                  hint: 'e.g. nomic-ai/nomic-embed-text-v2-moe' },
    { label: 'Reranker Model',      configKey: 'model.rerankerModel',          defaultValue: '',                    description: 'HuggingFace model ID for LMX reranking',                   hint: 'e.g. BAAI/bge-reranker-v2-m3' },
  ],
  safety: [
    { label: 'Autonomy Level',      configKey: 'autonomy.level',               defaultValue: '2',                   description: 'Default autonomy level (1–5)',
      inputType: 'slider', min: 1, max: 5, sliderLabels: { 1: 'safe', 2: 'standard', 3: 'extended', 4: 'delegation', 5: 'maximum' },
    },
    { label: 'Default Mode',        configKey: 'defaultMode',                  defaultValue: 'safe',                description: 'Default chat mode on session start',
      inputType: 'select', options: [
        { label: 'Safe',     value: 'safe',     description: 'Conservative — asks before acting' },
        { label: 'Auto',     value: 'auto',     description: 'Balanced autonomy with guardrails' },
        { label: 'Plan',     value: 'plan',     description: 'Plans before executing' },
        { label: 'Review',   value: 'review',   description: 'Code review focus' },
        { label: 'Research', value: 'research', description: 'Web research focus' },
      ],
    },
    { label: 'Autonomy Mode',       configKey: 'autonomy.mode',                defaultValue: 'execution',           description: 'Autonomy profile: execution or ceo',
      inputType: 'select', options: [
        { label: 'Execution', value: 'execution', description: 'Standard tool-use autonomy' },
        { label: 'CEO',       value: 'ceo',       description: 'High-level orchestration mode' },
      ],
    },
    { label: 'Max Tool Calls',      configKey: 'safety.circuitBreaker.pauseAt',defaultValue: '40',                  description: 'Pause after this many tool calls in one loop',              hint: 'Default: 40' },
    { label: 'Hard Stop At',        configKey: 'safety.circuitBreaker.hardStopAt', defaultValue: '100',             description: 'Hard-stop tool loop after this many calls',                hint: 'Default: 100' },
    { label: 'Compact At (%)',      configKey: 'safety.compactAt',             defaultValue: '0.7',                 description: 'Compact context at this fill fraction',                    hint: '0.7 = 70% of context limit' },
  ],
  paths: [
    { label: 'Session Logs Dir',    configKey: 'journal.sessionLogsDir',       defaultValue: '12-Session-Logs',     description: 'Where session log files are written',                      hint: 'Relative to project root' },
    { label: 'Update Logs Dir',     configKey: 'journal.updateLogsDir',        defaultValue: 'updates',             description: 'Where update record files are written',                    hint: 'Relative to project root' },
    { label: 'Journal Author',      configKey: 'journal.author',               defaultValue: '',                    description: 'Name used in journal entries',                              hint: 'Defaults to $USER' },
    { label: 'Journal Timezone',    configKey: 'journal.timezone',             defaultValue: 'local',               description: 'Timezone for journal timestamps',                          hint: 'local or IANA tz (e.g. Australia/Sydney)' },
    { label: 'Learning Ledger',     configKey: 'learning.ledgerPath',          defaultValue: '.opta/learning/ledger.jsonl', description: 'Path to learning reinforcement ledger',        hint: 'Relative or absolute' },
    { label: 'Policy Audit Log',    configKey: 'policy.audit.path',            defaultValue: '.opta/policy/audit.jsonl',   description: 'Path to policy audit log',                    hint: 'Relative or absolute' },
  ],
  advanced: [
    { label: 'Browser Enabled',     configKey: 'browser.enabled',              defaultValue: 'false',               description: 'Enable Playwright browser automation',
      inputType: 'toggle', options: [
        { label: 'Enabled',  value: 'true',  description: 'Playwright browser sessions available' },
        { label: 'Disabled', value: 'false', description: 'Browser automation off' },
      ],
    },
    { label: 'Browser Mode',        configKey: 'browser.mode',                 defaultValue: 'isolated',            description: 'Browser session mode',
      inputType: 'select', options: [
        { label: 'Isolated', value: 'isolated', description: 'Each session gets a fresh profile' },
        { label: 'Attach',   value: 'attach',   description: 'Attach to existing browser' },
      ],
    },
    { label: 'Max Browser Sessions',configKey: 'browser.runtime.maxSessions',  defaultValue: '3',                   description: 'Max concurrent browser sessions',
      inputType: 'slider', min: 1, max: 10, sliderLabels: { 1: 'minimal', 3: 'default', 5: 'moderate', 10: 'maximum' },
    },
    { label: 'Research Provider',   configKey: 'research.defaultProvider',     defaultValue: 'auto',                description: 'Default research provider',
      inputType: 'select', options: [
        { label: 'Auto',   value: 'auto',   description: 'Automatically pick best provider' },
        { label: 'Tavily', value: 'tavily', description: 'AI-optimized search' },
        { label: 'Exa',    value: 'exa',    description: 'Neural semantic search' },
        { label: 'Brave',  value: 'brave',  description: 'Brave Search API' },
        { label: 'Gemini', value: 'gemini', description: 'Google Gemini grounding' },
        { label: 'Groq',   value: 'groq',   description: 'Groq-powered search' },
      ],
    },
    { label: 'SearXNG URL',         configKey: 'search.searxngUrl',            defaultValue: 'http://localhost:8081', description: 'SearXNG instance URL',                                hint: 'Self-hosted or remote' },
    { label: 'TUI Default',         configKey: 'tui.default',                  defaultValue: 'false',               description: 'Launch TUI automatically on opta (legacy, now always true)',
      inputType: 'toggle', options: [
        { label: 'Enabled',  value: 'true',  description: 'Always start in TUI mode' },
        { label: 'Disabled', value: 'false', description: 'Start in plain CLI mode' },
      ],
    },
    { label: 'Response Intent Tone',configKey: 'tui.responseIntentTone',       defaultValue: 'technical',           description: 'Tone of completion intent summary shown per response',
      inputType: 'select', options: [
        { label: 'Concise',   value: 'concise',   description: 'Brief, minimal summaries' },
        { label: 'Technical', value: 'technical', description: 'Detailed technical context' },
        { label: 'Product',   value: 'product',   description: 'Product/feature-oriented' },
      ],
    },
    { label: 'Brave API Key',       configKey: 'research.providers.brave.apiKey',    defaultValue: '', sensitive: true, description: 'Brave Search API key', hint: 'api.search.brave.com' },
    { label: 'Exa API Key',         configKey: 'research.providers.exa.apiKey',      defaultValue: '', sensitive: true, description: 'Exa neural search API key', hint: 'exa.ai' },
    { label: 'Tavily API Key',      configKey: 'research.providers.tavily.apiKey',   defaultValue: '', sensitive: true, description: 'Tavily AI search API key', hint: 'tavily.com' },
    { label: 'Gemini API Key',      configKey: 'research.providers.gemini.apiKey',   defaultValue: '', sensitive: true, description: 'Google Gemini API key', hint: 'aistudio.google.com' },
  ],
  atpo: [
    { label: 'Atpo Enabled',      configKey: 'atpo.enabled',               defaultValue: 'true',                description: 'Enable Atpo autonomous supervisor', inputType: 'toggle', options: [{label: 'Enabled', value: 'true'}, {label: 'Disabled', value: 'false'}] },
    { label: 'Provider',          configKey: 'atpo.provider',              defaultValue: 'auto',                description: 'Provider to use for Atpo', inputType: 'select', options: [{label: 'Auto', value: 'auto'}, {label: 'Anthropic', value: 'anthropic'}, {label: 'Gemini', value: 'gemini'}, {label: 'OpenAI', value: 'openai'}, {label: 'OpenCode Zen', value: 'opencode_zen'}] },
    { label: 'API Key',           configKey: 'atpo.apiKey',                defaultValue: '', sensitive: true,   description: 'API key for Atpo provider (leave blank if auto)', hint: 'Automatically detected if possible' },
    { label: 'Model',             configKey: 'atpo.model',                 defaultValue: '',                    description: 'Specific model name for Atpo', hint: 'Leave blank for default' },
    { label: 'Payment Method',    configKey: 'atpo.paymentMethod',         defaultValue: 'pay-as-you-go',       description: 'Billing structure for cost estimation', inputType: 'select', options: [{label: 'Pay-As-You-Go', value: 'pay-as-you-go'}, {label: 'Subscription Plan', value: 'subscription'}] },
    { label: 'Autonomy Level',    configKey: 'atpo.autonomyLevel',         defaultValue: '2',                   description: 'Extent of proactive help (0=Fallback, 1=Warn, 2=Auto-Debug, 3=Co-Pilot, 4=Full)', inputType: 'slider', min: 0, max: 4, sliderLabels: { 0: 'Fallback', 1: 'Warn', 2: 'Auto-Debug', 3: 'Co-Pilot', 4: 'Full' } },
    { label: 'Error Threshold',   configKey: 'atpo.thresholds.errorCount', defaultValue: '3',                   description: 'Number of consecutive errors to trigger intervention', inputType: 'slider', min: 1, max: 10 },
    { label: 'Auto Pause Limit',  configKey: 'atpo.limits.autoPauseThreshold', defaultValue: '5',               description: 'Pause Atpo after this much cost/percentage is reached', hint: 'Value based on payment method' },
    { label: 'Provider Failover', configKey: 'atpo.limits.providerFailover', defaultValue: 'false',             description: 'Switch providers when limit is reached instead of pausing', inputType: 'toggle', options: [{label: 'Enabled', value: 'true'}, {label: 'Disabled', value: 'false'}] },
  ],
  account: [
    {
      label: 'Sign In',
      description: 'Open accounts.optalocal.com to sign in',
      configKey: '__account_signin',
      defaultValue: '',
      inputType: 'action',
      action: () => openInBrowser('https://accounts.optalocal.com'),
      hint: 'Opens accounts.optalocal.com in your default browser',
    },
  ],
};

// --- COLORS ---

/** Semantic color tokens reused across the settings overlay UI. */
const COLOR = {
  success: '#10b981',
  warning: '#f59e0b',
  error:   '#ef4444',
  muted:   '#4b5563',
} as const;

// --- HELPERS ---

/**
 * Reads a flat dot-notation key from the config snapshot, coercing to string.
 * Returns `defaultVal` when config is absent or the key is unset.
 */
function getConfigValue(config: Record<string, unknown> | undefined, key: string, defaultVal: string): string {
  if (!config) return defaultVal;
  const val = config[key];
  if (val === undefined || val === null) return defaultVal;
  return String(val);
}

/**
 * Returns the Unicode glyph that reflects whether a config field has been set.
 * Sensitive fields use a warning glyph when still at the default (likely empty).
 */
function statusGlyph(value: string, defaultVal: string, sensitive?: boolean): string {
  if (!value || value === defaultVal) return sensitive ? '⚠' : '○';
  return '✓';
}

/**
 * Returns the color that reflects whether a config field has been set.
 * Sensitive fields use a warning color when still at the default (likely empty).
 */
function statusColor(value: string, defaultVal: string, sensitive?: boolean): string {
  if (!value || value === defaultVal) return sensitive ? COLOR.warning : COLOR.muted;
  return COLOR.success;
}

const SECS_PER_HOUR = 3_600;
const SECS_PER_DAY  = 86_400;

/**
 * Converts a Unix timestamp (seconds) into a human-readable expiry label and
 * a color indicating whether the token is still valid or has expired.
 */
function formatTokenExpiry(expiresAt: number | undefined): { label: string; color: string } {
  if (expiresAt === undefined) return { label: 'unknown', color: COLOR.muted };
  const nowSecs = Math.floor(Date.now() / 1000);
  const diffSecs = expiresAt - nowSecs;
  const absSecs = Math.abs(diffSecs);
  const h = Math.floor(absSecs / SECS_PER_HOUR);
  const m = Math.floor((absSecs % SECS_PER_HOUR) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h === 0) parts.push(`${m}m`);
  const humanTime = parts.join(' ');
  if (diffSecs > 0) {
    return { label: `in ${humanTime}`, color: COLOR.success };
  }
  const daysAgo = Math.floor(absSecs / SECS_PER_DAY);
  if (daysAgo >= 1) {
    return { label: `expired ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`, color: COLOR.error };
  }
  return { label: `expired ${humanTime} ago`, color: COLOR.error };
}

/**
 * Returns the display profile that follows `current` in the cycle order,
 * wrapping back to the first profile after the last.
 */
function nextSettingsDisplayProfile(current: SettingsDisplayProfile): SettingsDisplayProfile {
  const currentIdx = SETTINGS_DISPLAY_PROFILES.indexOf(current);
  const safeIdx = currentIdx >= 0 ? currentIdx : 0;
  return SETTINGS_DISPLAY_PROFILES[(safeIdx + 1) % SETTINGS_DISPLAY_PROFILES.length]!;
}

/**
 * Parses a CSI-u extended key event escape sequence (Kitty protocol subset).
 * Returns the codepoint and modifier flags, or `null` for non-matching input.
 * Modifier encoding: bit 0 = Shift, bit 1 = Meta/Alt, bit 2 = Ctrl.
 */
function parseCsiUKeyEvent(input: string): { codepoint: number; ctrl: boolean; shift: boolean; meta: boolean } | null {
  const match = input.match(/^\x1B\[(\d+);(\d+)u$/i);
  if (!match) return null;
  const codepoint = Number(match[1]);
  const modifier = Number(match[2]);
  if (!Number.isInteger(codepoint) || !Number.isInteger(modifier) || modifier < 1) return null;
  const modifierMask = modifier - 1;
  return {
    codepoint,
    shift: (modifierMask & 1) !== 0,
    meta:  (modifierMask & 2) !== 0,
    ctrl:  (modifierMask & 4) !== 0,
  };
}

/**
 * Returns true when the key event represents Ctrl+S (without Meta/Alt).
 * Handles both the legacy `\x13` byte and the CSI-u extended key protocol
 * so the shortcut works across terminals that emit different sequences.
 */
function isCtrlSShortcut(input: string, key: { ctrl?: boolean; meta?: boolean }): boolean {
  const csiU = parseCsiUKeyEvent(input);
  const ctrlPressed = (key.ctrl ?? false) || (csiU?.ctrl ?? false);
  const metaPressed = (key.meta ?? false) || (csiU?.meta ?? false);
  if (!ctrlPressed || metaPressed) return false;
  if (input === '\x13') return true;
  const normalized = csiU ? String.fromCodePoint(csiU.codepoint) : input;
  return normalized.toLowerCase() === 's';
}

/**
 * Filters a page's settings items to those appropriate for the active display profile.
 * - `advanced`: all items shown.
 * - `compact`: only the curated subset in {@link COMPACT_PROFILE_KEYS}.
 * - `opta` (default): everything except deep expert options in {@link ADVANCED_PROFILE_ONLY_KEYS}.
 */
function filterItemsForDisplayProfile(
  items: SettingsItem[],
  profile: SettingsDisplayProfile,
): SettingsItem[] {
  if (profile === 'advanced') return items;
  if (profile === 'compact') return items.filter((item) => COMPACT_PROFILE_KEYS.has(item.configKey));
  // 'opta' profile: curated defaults — omit deep expert keys.
  return items.filter((item) => !ADVANCED_PROFILE_ONLY_KEYS.has(item.configKey));
}

// --- ACCOUNT PAGE COMPONENT ---

interface AccountPageContentProps {
  accountState: AccountState | null | 'loading';
  pageColor: string;
  syncStatus: 'idle' | 'running' | 'success' | 'error';
  syncMessage: string | null;
}

function accountIdentity(state: AccountState | null): string | null {
  return state?.user?.email ?? state?.user?.phone ?? state?.user?.id ?? null;
}

function AccountPageContent({
  accountState,
  pageColor,
  syncStatus,
  syncMessage,
}: AccountPageContentProps): React.ReactElement {
  if (accountState === 'loading') {
    return (
      <Box marginTop={1}>
        <Text dimColor>◔ Loading account...</Text>
      </Box>
    );
  }

  const supabaseConfigured = Boolean(resolveSupabaseAuthConfig());

  const user = accountState?.user ?? null;
  const session = accountState?.session ?? null;
  const project = accountState?.project ?? null;

  const userIdentity = user
    ? (user.email ?? user.phone ?? String(user.id))
    : 'Not logged in';

  let tokenStatus: { label: string; color: string };
  if (!session) {
    tokenStatus = { label: 'None', color: COLOR.muted };
  } else {
    const expiresAt = session.expires_at;
    if (expiresAt !== undefined) {
      const nowSecs = Math.floor(Date.now() / 1000);
      tokenStatus = expiresAt > nowSecs
        ? { label: 'Valid', color: COLOR.success }
        : { label: 'Expired', color: COLOR.error };
    } else {
      tokenStatus = { label: 'Valid', color: COLOR.success };
    }
  }

  const expiryInfo = session ? formatTokenExpiry(session.expires_at) : null;

  return (
    <Box marginTop={1} flexDirection="column">
      {/* User row */}
      <Box>
        <Text dimColor>  User     </Text>
        <Text color={user ? pageColor : COLOR.muted} bold={Boolean(user)}>
          {userIdentity}
        </Text>
      </Box>

      {/* Project row */}
      <Box>
        <Text dimColor>  Project  </Text>
        {project
          ? <Text color={pageColor}>{project}</Text>
          : <Text dimColor>(not set)</Text>
        }
      </Box>

      {/* Token status row */}
      <Box>
        <Text dimColor>  Token    </Text>
        <Text color={tokenStatus.color} bold>{tokenStatus.label}</Text>
      </Box>

      {/* Expiry row */}
      {expiryInfo && (
        <Box>
          <Text dimColor>  Expires  </Text>
          <Text color={expiryInfo.color}>{expiryInfo.label}</Text>
        </Box>
      )}

      {/* Config row */}
      <Box marginTop={1}>
        <Text dimColor>  Config   </Text>
        {supabaseConfigured
          ? <Text color={COLOR.success}>Supabase configured</Text>
          : <Text color={COLOR.warning}>{'⚠ OPTA_SUPABASE_URL not set'}</Text>
        }
      </Box>

      {syncMessage && (
        <Box>
          <Text dimColor>  Sync     </Text>
          <Text
            color={
              syncStatus === 'error'
                ? COLOR.error
                : syncStatus === 'running'
                  ? pageColor
                  : syncStatus === 'success'
                    ? COLOR.success
                    : COLOR.muted
            }
          >
            {syncMessage}
          </Text>
        </Box>
      )}

    </Box>
  );
}

// --- ANIMATION THRESHOLDS ---

/** Progress fraction at which the header and hint text become visible. */
const ANIM_SHOW_CONTENT_AT  = 0.28;
/** Progress fraction at which the items list becomes visible. */
const ANIM_SHOW_ITEMS_AT    = 0.55;
/** Progress fraction below which the overlay is considered still animating. */
const ANIM_TRANSITION_AT    = 0.95;
/** Width scale: minimum fraction of full width during open animation. */
const ANIM_WIDTH_BASE       = 0.55;
/** Height scale: minimum fraction of full height during open animation. */
const ANIM_HEIGHT_BASE      = 0.45;

// --- COMPONENT ---

export function SettingsOverlay({
  animationPhase = 'open',
  animationProgress = 1,
  maxWidth,
  maxHeight,
  config,
  onClose,
  onSave,
}: SettingsOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? 36;

  const normalizedProgress = Math.max(0, Math.min(1, Number.isFinite(animationProgress) ? animationProgress : 1));
  const rows = Math.max(14, Math.min(stdoutRows, maxHeight ?? stdoutRows));
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(70, Math.min(120, columns - 8));
  const width = Math.min(preferred, hardMax);
  const animatedWidth = Math.max(40, Math.floor(width * (ANIM_WIDTH_BASE + ((1 - ANIM_WIDTH_BASE) * normalizedProgress))));
  const visualRows = Math.max(10, Math.floor(rows * (ANIM_HEIGHT_BASE + ((1 - ANIM_HEIGHT_BASE) * normalizedProgress))));

  // Reserved for future CSS-class gating during open/close transitions.
  const _transitionActive = animationPhase !== 'open' || normalizedProgress < ANIM_TRANSITION_AT;
  const showContent = normalizedProgress >= ANIM_SHOW_CONTENT_AT;
  const showItems = normalizedProgress >= ANIM_SHOW_ITEMS_AT;

  const [selectedPage, setSelectedPage] = useState<SettingsPageId>('connection');
  const [displayProfile, setDisplayProfile] = useState<SettingsDisplayProfile>('opta');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [changes, setChanges] = useState<Record<string, unknown>>({});

  // Account page state
  const [accountState, setAccountState] = useState<AccountState | null | 'loading'>('loading');
  const [accountSyncStatus, setAccountSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [accountSyncMessage, setAccountSyncMessage] = useState<string | null>(null);
  const accountSignInInFlightRef = useRef(false);

  const runAccountOauthSignIn = useCallback(async (trigger: 'auto' | 'manual') => {
    if (accountSignInInFlightRef.current) return;
    accountSignInInFlightRef.current = true;
    setAccountSyncStatus('running');
    setAccountSyncMessage(trigger === 'auto'
      ? 'Opening Opta account sign-in to sync this CLI session…'
      : 'Opening Opta account sign-in…');
    try {
      const config = resolveSupabaseAuthConfig();
      if (!config) {
        setAccountSyncStatus('error');
        setAccountSyncMessage('Set OPTA_SUPABASE_URL and OPTA_SUPABASE_ANON_KEY to enable CLI account sync.');
        if (trigger === 'manual') {
          openInBrowser('https://accounts.optalocal.com');
        }
        return;
      }
      const { runOAuthLoginFlow } = await import('../commands/account.js');
      const result = await runOAuthLoginFlow({ browserMode: 'opta-session' });
      setAccountState(result.state);
      const identity = result.user?.email ?? result.user?.phone ?? result.user?.id ?? accountIdentity(result.state);
      setAccountSyncStatus('success');
      setAccountSyncMessage(identity
        ? `Signed in as ${identity}`
        : 'Sign-in complete. Account state synced.');
    } catch (err) {
      setAccountSyncStatus('error');
      setAccountSyncMessage(errorMessage(err));
    } finally {
      accountSignInInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (selectedPage !== 'account') return;
    let cancelled = false;

    const loadAndMaybeAutoSignIn = async (): Promise<void> => {
      setAccountState('loading');
      setAccountSyncStatus('idle');
      setAccountSyncMessage(null);

      try {
        const { loadAccountState } = await import('../accounts/storage.js');
        const state = await loadAccountState();
        if (cancelled) return;
        setAccountState(state);

        if (state?.session?.access_token) {
          const identity = accountIdentity(state);
          setAccountSyncStatus('success');
          setAccountSyncMessage(identity ? `Session active for ${identity}` : 'Session active.');
          return;
        }

        if (process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test') {
          return;
        }

        if (!resolveSupabaseAuthConfig()) {
          return;
        }

        await runAccountOauthSignIn('auto');
      } catch (err) {
        if (cancelled) return;
        setAccountState(null);
        setAccountSyncStatus('error');
        setAccountSyncMessage(errorMessage(err));
      }
    };

    void loadAndMaybeAutoSignIn();
    return () => {
      cancelled = true;
    };
  }, [selectedPage, runAccountOauthSignIn]);

  const items = useMemo(
    () => filterItemsForDisplayProfile(PAGE_ITEMS[selectedPage], displayProfile),
    [selectedPage, displayProfile],
  );
  const pageMeta = PAGES.find(p => p.id === selectedPage);
  const pageColor = pageMeta?.color ?? '#0ea5e9';

  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const itemViewportRows = Math.max(4, Math.min(items.length, visualRows - 18));
  const itemWindow = useMemo(() => {
    if (items.length <= itemViewportRows) return { start: 0, end: items.length };
    const halfViewport = Math.floor(itemViewportRows / 2);
    let start = Math.max(0, selectedIndex - halfViewport);
    let end = start + itemViewportRows;
    if (end > items.length) { end = items.length; start = Math.max(0, end - itemViewportRows); }
    return { start, end };
  }, [itemViewportRows, items.length, selectedIndex]);

  /** Navigates to a settings page, resetting item selection and any in-progress edit. */
  const setPage = useCallback((id: SettingsPageId) => {
    setSelectedPage(id);
    setSelectedIndex(0);
    setEditingKey(null);
  }, []);

  const currentValue = useCallback((item: SettingsItem): string => {
    const pendingVal = changes[item.configKey];
    if (pendingVal !== undefined) return String(pendingVal);
    return getConfigValue(config, item.configKey, item.defaultValue);
  }, [changes, config]);

  const commitEdit = useCallback(() => {
    if (!editingKey) return;
    setChanges(prev => ({ ...prev, [editingKey]: editValue }));
    setEditingKey(null);
  }, [editingKey, editValue]);

  // Look up the editing item's metadata to determine input type
  const editingItem = useMemo(
    () => editingKey ? items.find(i => i.configKey === editingKey) ?? null : null,
    [editingKey, items],
  );
  const editingInputType: NonNullable<SettingsItem['inputType']> = editingItem?.inputType ?? 'text';

  // Callbacks for InlineSelect and InlineSlider
  const handleSelectConfirm = useCallback((value: string) => {
    if (!editingKey) return;
    setChanges(prev => ({ ...prev, [editingKey]: value }));
    setEditingKey(null);
  }, [editingKey]);

  const handleSliderConfirm = useCallback((value: number) => {
    if (!editingKey) return;
    setChanges(prev => ({ ...prev, [editingKey]: String(value) }));
    setEditingKey(null);
  }, [editingKey]);

  /** Discards any in-progress inline edit and returns to the item list. */
  const handleEditCancel = useCallback(() => {
    setEditingKey(null);
  }, []);

  /** Immediately flips a boolean toggle without opening the inline editor. */
  const handleToggleQuick = useCallback((toggleItem: SettingsItem) => {
    const next = currentValue(toggleItem) === 'true' ? 'false' : 'true';
    setChanges(prev => ({ ...prev, [toggleItem.configKey]: next }));
  }, [currentValue]);

  useInput((input, key) => {
    // If editing a select/toggle/slider field, let the child component handle input
    if (editingKey && editingInputType !== 'text') {
      return;
    }
    // If editing a text field, only Enter (commit) and Esc (cancel) are handled here;
    // all other keys are forwarded to the TextInput child component.
    if (editingKey) {
      if (key.return) { commitEdit(); return; }
      if (key.escape) { setEditingKey(null); }
      return;
    }

    if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
      onClose(); return;
    }

    if (key.tab && key.shift) {
      setDisplayProfile((prev) => nextSettingsDisplayProfile(prev));
      setSelectedIndex(0);
      setEditingKey(null);
      return;
    }

    if (key.leftArrow || input === 'h') {
      const prev = (PAGE_INDEX[selectedPage] + PAGES.length - 1) % PAGES.length;
      setPage(PAGES[prev]!.id); return;
    }
    if (key.rightArrow || input === 'l') {
      const next = (PAGE_INDEX[selectedPage] + 1) % PAGES.length;
      setPage(PAGES[next]!.id); return;
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => (prev - 1 + items.length) % items.length); return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => (prev + 1) % items.length); return;
    }

    // Number shortcuts for pages
    const num = Number(input);
    if (!key.ctrl && !key.meta && !Number.isNaN(num) && num >= 1 && num <= PAGES.length) {
      setPage(PAGES[num - 1]!.id); return;
    }

    // Ctrl+S (or Ctrl+Shift+S when emitted as CSI-u) saves all changes.
    if (isCtrlSShortcut(input, key)) {
      onSave(changes); onClose(); return;
    }

    // Enter / Space = activate action, quick-toggle, or open inline editor.
    if (key.return || input === ' ') {
      const item = items[selectedIndex];
      if (!item) return;
      if (item.inputType === 'action') {
        if (item.configKey === '__account_signin') {
          void runAccountOauthSignIn('manual');
        } else {
          void item.action?.();
        }
        return;
      }
      if (item.inputType === 'toggle') {
        handleToggleQuick(item);
        return;
      }
      setEditingKey(item.configKey);
      setEditValue(currentValue(item));
    }
  });

  const unsavedCount = Object.keys(changes).length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={pageColor}
      width={animatedWidth}
      paddingX={2}
      paddingY={1}
      overflow="hidden"
    >
      {/* HEADER */}
      <Box justifyContent="space-between">
        <Text color={pageColor} bold>
          {OPTA_BRAND_GLYPH} {OPTA_BRAND_NAME} Settings{unsavedCount > 0 ? ` (${unsavedCount} unsaved)` : ''}
        </Text>
        <Text dimColor>Shift+Tab view · Ctrl+S save · Esc close</Text>
      </Box>

      {showContent ? (
        <>
          {/* HINT */}
          <Box marginTop={1}>
            <Text dimColor>{`←/→ switch page · ↑/↓ navigate · Enter/Space edit · 1-${PAGES.length} jump · Shift+Tab view`}</Text>
          </Box>
          <Box>
            <Text dimColor>View: </Text>
            <Text color={pageColor} bold>{SETTINGS_DISPLAY_PROFILE_LABEL[displayProfile]}</Text>
          </Box>

          {/* PAGE TABS */}
          <Box marginTop={1} marginBottom={1}>
            {PAGES.map((page, i) => (
              <Box key={page.id} marginRight={2}>
                <Text
                  color={selectedPage === page.id ? page.color : undefined}
                  bold={selectedPage === page.id}
                >
                  {selectedPage === page.id ? '[x]' : '[ ]'} {i + 1}. {page.label}
                </Text>
              </Box>
            ))}
          </Box>

          <Text color={pageColor} bold>{pageMeta?.label ?? 'Settings'}</Text>

          {/* EDITING PANEL */}
          {editingKey && editingItem ? (
            <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={pageColor} paddingX={1}>
              <Text color={pageColor} bold>Editing: {editingItem.label}</Text>
              {editingInputType === 'select' && editingItem.options ? (
                <Box marginTop={1}>
                  <InlineSelect
                    options={editingItem.options}
                    value={currentValue(editingItem)}
                    onSelect={handleSelectConfirm}
                    onCancel={handleEditCancel}
                    color={pageColor}
                    focus
                  />
                </Box>
              ) : editingInputType === 'slider' && editingItem.min !== undefined && editingItem.max !== undefined ? (
                <Box marginTop={1}>
                  <InlineSlider
                    min={editingItem.min}
                    max={editingItem.max}
                    value={parseInt(currentValue(editingItem), 10) || editingItem.min}
                    onSelect={handleSliderConfirm}
                    onCancel={handleEditCancel}
                    color={pageColor}
                    labels={editingItem.sliderLabels}
                    focus
                  />
                </Box>
              ) : (
                <>
                  <Box marginTop={1}>
                    <Text dimColor>Value: </Text>
                    <TextInput
                      value={editValue}
                      onChange={setEditValue}
                      mask={editingItem.sensitive ? '*' : undefined}
                      focus
                    />
                  </Box>
                  {editingItem.hint && <Text dimColor>{editingItem.hint}</Text>}
                  <Box marginTop={1}><Text dimColor>Enter to save · Esc to cancel</Text></Box>
                </>
              )}
            </Box>
          ) : null}

          {/* ACCOUNT PAGE */}
          {showItems && !editingKey && selectedPage === 'account' ? (
            <AccountPageContent
              accountState={accountState}
              pageColor={pageColor}
              syncStatus={accountSyncStatus}
              syncMessage={accountSyncMessage}
            />
          ) : null}

          {/* ITEMS LIST */}
          {showItems && !editingKey ? (
            <>
              {itemWindow.start > 0 && <Text dimColor>… {itemWindow.start} above …</Text>}
              {items.slice(itemWindow.start, itemWindow.end).map((item, idx) => {
                const absoluteIdx = itemWindow.start + idx;
                const isSelected = absoluteIdx === selectedIndex;
                const configVal = currentValue(item);
                const isActionItem = item.inputType === 'action';
                // Resolve the human-readable label for select/toggle items.
                const selectLabel = (item.inputType === 'select' || item.inputType === 'toggle')
                  ? item.options?.find(o => o.value === configVal)?.label ?? configVal
                  : null;
                const displayVal = isActionItem
                  ? (item.hint ?? '')
                  : item.sensitive && configVal && configVal !== item.defaultValue
                    ? '●●●●●'
                    : item.inputType === 'toggle'
                      ? (configVal === 'true' ? '[x]' : '[ ]') + ' ' + (selectLabel ?? configVal)
                      : item.inputType === 'slider' && item.sliderLabels
                        ? `${configVal} — ${item.sliderLabels[parseInt(configVal, 10)] ?? ''}`
                        : selectLabel ?? (configVal || '(not set)');
                const glyph = isActionItem ? '→' : statusGlyph(configVal, item.defaultValue, item.sensitive);
                const glyphColor = isActionItem ? pageColor : statusColor(configVal, item.defaultValue, item.sensitive);
                const isChanged = !isActionItem && changes[item.configKey] !== undefined;
                // Keyboard hint shown next to the active item based on its input type.
                const interactionHint = isSelected && isActionItem
                  ? 'Enter to open'
                  : isSelected && item.inputType === 'toggle'
                    ? 'Enter/Space toggle'
                    : isSelected && (item.inputType === 'select' || item.inputType === 'slider')
                      ? 'Enter to choose'
                      : null;

                return (
                  <Box key={item.configKey} flexDirection="column">
                    <Box>
                      <Text color={isSelected ? pageColor : undefined}>{isSelected ? '▶ ' : '  '}</Text>
                      <Text color={isSelected ? pageColor : undefined} bold={isSelected}>{item.label}</Text>
                      <Text color={glyphColor}> {glyph}</Text>
                      {isChanged && <Text color={COLOR.warning}> *</Text>}
                      <Text dimColor>  {displayVal}</Text>
                      {isSelected && displayProfile !== 'compact' && <Text dimColor>  — {item.description}</Text>}
                      {interactionHint && <Text dimColor>  ({interactionHint})</Text>}
                    </Box>
                    {isSelected && displayProfile === 'advanced' && (
                      <Box paddingLeft={3}>
                        <Text dimColor>{item.configKey}</Text>
                        {item.hint ? <Text dimColor>  ·  {item.hint}</Text> : null}
                      </Box>
                    )}
                  </Box>
                );
              })}
              {itemWindow.end < items.length && <Text dimColor>… {items.length - itemWindow.end} below …</Text>}
            </>
          ) : !editingKey ? (
            <Box marginTop={1}><Text dimColor>◔ Loading settings...</Text></Box>
          ) : null}
        </>
      ) : (
        <Box marginTop={1}><Text dimColor>◔ Opening settings...</Text></Box>
      )}
    </Box>
  );
}
