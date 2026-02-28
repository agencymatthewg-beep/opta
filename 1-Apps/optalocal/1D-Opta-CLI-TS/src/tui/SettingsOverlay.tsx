import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import type { AccountState } from '../accounts/types.js';
import { InlineSelect, InlineSlider, type SelectOption } from './InlineSelect.js';

// --- TYPES ---

type SettingsPageId = 'connection' | 'models' | 'safety' | 'paths' | 'advanced' | 'account';
type SettingsDisplayProfile = 'compact' | 'opta' | 'advanced';

interface SettingsPage { id: SettingsPageId; label: string; color: string; }

interface SettingsItem {
  label: string;
  description: string;
  configKey: string;
  defaultValue: string;
  sensitive?: boolean;      // Mask value with ***
  validate?: (v: string) => string | null; // Return error string or null
  hint?: string;            // Extra help below input
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
  action?: () => void;
}

export interface SettingsOverlayProps {
  animationPhase?: 'opening' | 'open' | 'closing';
  animationProgress?: number;
  maxWidth?: number;
  maxHeight?: number;
  config?: Record<string, unknown>; // Flat dot-notation config snapshot
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
  { id: 'account',    label: 'Account',     color: '#f472b6' },
];

const PAGE_INDEX = PAGES.reduce<Record<SettingsPageId, number>>((acc, p, i) => {
  acc[p.id] = i; return acc;
}, { connection: 0, models: 1, safety: 2, paths: 3, advanced: 4, account: 5 });

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

/** Open a URL in the OS default browser (cross-platform, fire-and-forget). */
function openInBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32'  ? 'start' :
    'xdg-open';
  import('node:child_process').then(({ spawn }) => {
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  }).catch(() => { /* ignore — browser open is best-effort */ });
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
    { label: 'TUI Default',         configKey: 'tui.default',                  defaultValue: 'false',               description: 'Launch TUI automatically on opta chat',
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

// --- HELPERS ---

function getConfigValue(config: Record<string, unknown> | undefined, key: string, defaultVal: string): string {
  if (!config) return defaultVal;
  const val = config[key];
  if (val === undefined || val === null) return defaultVal;
  return String(val);
}

function statusGlyph(value: string, defaultVal: string, sensitive?: boolean): string {
  if (!value || value === defaultVal) return sensitive ? '⚠' : '○';
  return '✓';
}

function statusColor(value: string, defaultVal: string, sensitive?: boolean): string {
  if (!value || value === defaultVal) return sensitive ? '#f59e0b' : '#4b5563';
  return '#10b981';
}

function formatTokenExpiry(expiresAt: number | undefined): { label: string; color: string } {
  if (expiresAt === undefined) return { label: 'unknown', color: '#4b5563' };
  const nowSecs = Math.floor(Date.now() / 1000);
  const diffSecs = expiresAt - nowSecs;
  const absSecs = Math.abs(diffSecs);
  const h = Math.floor(absSecs / 3600);
  const m = Math.floor((absSecs % 3600) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h === 0) parts.push(`${m}m`);
  const humanTime = parts.join(' ');
  if (diffSecs > 0) {
    return { label: `in ${humanTime}`, color: '#10b981' };
  }
  const daysAgo = Math.floor(absSecs / 86400);
  if (daysAgo >= 1) {
    return { label: `expired ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`, color: '#ef4444' };
  }
  return { label: `expired ${humanTime} ago`, color: '#ef4444' };
}

function nextSettingsDisplayProfile(current: SettingsDisplayProfile): SettingsDisplayProfile {
  const currentIndex = SETTINGS_DISPLAY_PROFILES.indexOf(current);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  return SETTINGS_DISPLAY_PROFILES[(safeIndex + 1) % SETTINGS_DISPLAY_PROFILES.length]!;
}

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
    meta: (modifierMask & 2) !== 0,
    ctrl: (modifierMask & 4) !== 0,
  };
}

function isCtrlSShortcut(
  input: string,
  key: { ctrl?: boolean; meta?: boolean },
): boolean {
  const csiU = parseCsiUKeyEvent(input);
  const ctrlPressed = Boolean(key.ctrl) || Boolean(csiU?.ctrl);
  const metaPressed = Boolean(key.meta) || Boolean(csiU?.meta);
  if (!ctrlPressed || metaPressed) return false;
  if (input === '\x13') return true;
  const normalized = csiU ? String.fromCodePoint(csiU.codepoint) : input;
  return normalized.toLowerCase() === 's';
}

function filterItemsForDisplayProfile(
  items: SettingsItem[],
  profile: SettingsDisplayProfile,
): SettingsItem[] {
  if (profile === 'advanced') return items;
  if (profile === 'compact') {
    return items.filter((item) => COMPACT_PROFILE_KEYS.has(item.configKey));
  }
  // "Opta" profile = default curated settings, excluding deep expert options.
  return items.filter((item) => !ADVANCED_PROFILE_ONLY_KEYS.has(item.configKey));
}

// --- ACCOUNT PAGE COMPONENT ---

interface AccountPageContentProps {
  accountState: AccountState | null | 'loading';
  pageColor: string;
}

function AccountPageContent({ accountState, pageColor }: AccountPageContentProps): React.ReactElement {
  if (accountState === 'loading') {
    return (
      <Box marginTop={1}>
        <Text dimColor>◔ Loading account...</Text>
      </Box>
    );
  }

  const supabaseUrl = process.env['OPTA_SUPABASE_URL'];
  const supabaseConfigured = Boolean(supabaseUrl && supabaseUrl.trim().length > 0);

  const user = accountState?.user ?? null;
  const session = accountState?.session ?? null;
  const project = accountState?.project ?? null;

  const userIdentity = user
    ? (user.email ?? user.phone ?? String(user.id))
    : 'Not logged in';

  let tokenStatus: { label: string; color: string };
  if (!session) {
    tokenStatus = { label: 'None', color: '#4b5563' };
  } else {
    const expiresAt = session.expires_at;
    if (expiresAt !== undefined) {
      const nowSecs = Math.floor(Date.now() / 1000);
      tokenStatus = expiresAt > nowSecs
        ? { label: 'Valid', color: '#10b981' }
        : { label: 'Expired', color: '#ef4444' };
    } else {
      tokenStatus = { label: 'Valid', color: '#10b981' };
    }
  }

  const expiryInfo = session ? formatTokenExpiry(session.expires_at) : null;

  return (
    <Box marginTop={1} flexDirection="column">
      {/* User row */}
      <Box>
        <Text dimColor>  User     </Text>
        <Text color={user ? pageColor : '#4b5563'} bold={Boolean(user)}>
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
          ? <Text color="#10b981">Supabase configured</Text>
          : <Text color="#f59e0b">{'⚠ OPTA_SUPABASE_URL not set'}</Text>
        }
      </Box>

    </Box>
  );
}

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
  const animatedWidth = Math.max(40, Math.floor(width * (0.55 + (0.45 * normalizedProgress))));
  const visualRows = Math.max(10, Math.floor(rows * (0.45 + (0.55 * normalizedProgress))));

  const transitionActive = animationPhase !== 'open' || normalizedProgress < 0.95;
  const showContent = normalizedProgress >= 0.28;
  const showItems = normalizedProgress >= 0.55;

  const [selectedPage, setSelectedPage] = useState<SettingsPageId>('connection');
  const [displayProfile, setDisplayProfile] = useState<SettingsDisplayProfile>('opta');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [changes, setChanges] = useState<Record<string, unknown>>({});

  // Account page state
  const [accountState, setAccountState] = useState<AccountState | null | 'loading'>('loading');

  useEffect(() => {
    if (selectedPage !== 'account') return;
    setAccountState('loading');
    import('../accounts/storage.js')
      .then(mod => mod.loadAccountState())
      .then(state => setAccountState(state))
      .catch(() => setAccountState(null));
  }, [selectedPage]);

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
    const half = Math.floor(itemViewportRows / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + itemViewportRows;
    if (end > items.length) { end = items.length; start = Math.max(0, end - itemViewportRows); }
    return { start, end };
  }, [itemViewportRows, items.length, selectedIndex]);

  const setPage = useCallback((id: SettingsPageId) => {
    setSelectedPage(id); setSelectedIndex(0); setEditingKey(null);
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
  const editingInputType = editingItem?.inputType ?? 'text';

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

  const handleEditCancel = useCallback(() => {
    setEditingKey(null);
  }, []);

  // For toggle items, Enter on the item list immediately cycles the value
  const handleToggleQuick = useCallback((item: SettingsItem) => {
    const cur = currentValue(item);
    const next = cur === 'true' ? 'false' : 'true';
    setChanges(prev => ({ ...prev, [item.configKey]: next }));
  }, [currentValue]);

  useInput((input, key) => {
    // If editing a select/toggle/slider field, let the child component handle input
    if (editingKey && editingInputType !== 'text') {
      return;
    }
    // If editing a text field, only handle Enter/Esc
    if (editingKey) {
      if (key.return) { commitEdit(); return; }
      if (key.escape) { setEditingKey(null); return; }
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

    // Enter = activate action / quick-toggle / open inline editor
    if (key.return) {
      const item = items[selectedIndex];
      if (!item) return;
      if (item.inputType === 'action') {
        item.action?.();
        return;
      }
      // Toggle items cycle directly without opening an editor
      if (item.inputType === 'toggle') {
        handleToggleQuick(item);
        return;
      }
      setEditingKey(item.configKey);
      setEditValue(currentValue(item));
      return;
    }

    // Space = same as Enter for activating / opening editor / toggling
    if (input === ' ') {
      const item = items[selectedIndex];
      if (!item) return;
      if (item.inputType === 'action') {
        item.action?.();
        return;
      }
      if (item.inputType === 'toggle') {
        handleToggleQuick(item);
        return;
      }
      setEditingKey(item.configKey);
      setEditValue(currentValue(item));
      return;
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
          Opta Settings{unsavedCount > 0 ? ` (${unsavedCount} unsaved)` : ''}
        </Text>
        <Text dimColor>Shift+Tab view · Ctrl+S save · Esc close</Text>
      </Box>

      {showContent ? (
        <>
          {/* HINT */}
          <Box marginTop={1}>
            <Text dimColor>←/→ switch page · ↑/↓ navigate · Enter/Space edit · 1-6 jump · Shift+Tab view</Text>
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
            <AccountPageContent accountState={accountState} pageColor={pageColor} />
          ) : null}

          {/* ITEMS LIST */}
          {showItems && !editingKey ? (
            <>
              {itemWindow.start > 0 && <Text dimColor>… {itemWindow.start} above …</Text>}
              {items.slice(itemWindow.start, itemWindow.end).map((item, idx) => {
                const abs = itemWindow.start + idx;
                const active = abs === selectedIndex;
                const val = currentValue(item);
                const isAction = item.inputType === 'action';
                // For selectable items, show the label instead of raw value
                const selectLabel = (item.inputType === 'select' || item.inputType === 'toggle')
                  ? item.options?.find(o => o.value === val)?.label ?? val
                  : null;
                const displayVal = isAction
                  ? (item.hint ?? '')
                  : item.sensitive && val && val !== item.defaultValue
                    ? '●●●●●'
                    : item.inputType === 'toggle'
                      ? (val === 'true' ? '[x]' : '[ ]') + ' ' + (selectLabel ?? val)
                      : item.inputType === 'slider' && item.sliderLabels
                        ? `${val} — ${item.sliderLabels[parseInt(val, 10)] ?? ''}`
                        : selectLabel ?? (val || '(not set)');
                const glyph = isAction ? '→' : statusGlyph(val, item.defaultValue, item.sensitive);
                const glyphColor = isAction ? pageColor : statusColor(val, item.defaultValue, item.sensitive);
                const changed = !isAction && changes[item.configKey] !== undefined;
                // Show interaction hint for active selectable/action items
                const interactionHint = active && isAction
                  ? 'Enter to open'
                  : active && item.inputType === 'toggle'
                    ? 'Enter/Space toggle'
                    : active && (item.inputType === 'select' || item.inputType === 'slider')
                      ? 'Enter to choose'
                      : null;

                return (
                  <Box key={item.configKey} flexDirection="column">
                    <Box>
                      <Text color={active ? pageColor : undefined}>{active ? '▶ ' : '  '}</Text>
                      <Text color={active ? pageColor : undefined} bold={active}>{item.label}</Text>
                      <Text color={glyphColor}> {glyph}</Text>
                      {changed && <Text color="#f59e0b"> *</Text>}
                      <Text dimColor>  {displayVal}</Text>
                      {active && displayProfile !== 'compact' && <Text dimColor>  — {item.description}</Text>}
                      {interactionHint && <Text dimColor>  ({interactionHint})</Text>}
                    </Box>
                    {active && displayProfile === 'advanced' && (
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
