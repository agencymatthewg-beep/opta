import { useState, useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_CONFIG } from '../../core/config.js';
import {
  loadKeybindings,
  mergeKeybindings,
  type KeybindingConfig,
  type KeybindingOverrides,
} from '../keybindings.js';
import type { ConnectionState } from '../utils.js';
import type { AccountState } from '../../accounts/types.js';
import type { StudioConnectivityState } from '../OptaMenuOverlay.js';
import type { ResponseIntentTone } from '../response-intent.js';
import { DEFAULT_TRIGGER_MODE_DEFINITIONS, type TriggerModeDefinition } from '../trigger-router.js';
import { homedir } from '../../platform/index.js';

interface SkillRuntimeSettings {
  dynamicLoading: boolean;
  unloadInactive: boolean;
  ttlMinutes: number;
  maxActiveSkills: number;
}

const DEFAULT_SKILL_RUNTIME_SETTINGS: SkillRuntimeSettings = {
  dynamicLoading: true,
  unloadInactive: true,
  ttlMinutes: 30,
  maxActiveSkills: 24,
};

function isLocalHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function expandHomePath(pathValue: string): string {
  if (!pathValue.startsWith('~/') && pathValue !== '~') return pathValue;
  return homedir() + pathValue.slice(1);
}

export interface UseAppConfigReturn {
  // Connection details
  connectionHost: string;
  connectionFallbackHosts: string[];
  connectionPort: number;
  connectionAdminKey: string | undefined;
  connectionSshUser: string;
  connectionSshIdentityFile: string;
  connectionSshConnectTimeoutSec: number;
  studioConnectivity: StudioConnectivityState;

  // Account
  accountState: AccountState | null;

  // Trigger/skill/response-intent config
  triggerDefinitions: TriggerModeDefinition[];
  skillRuntimeSettings: SkillRuntimeSettings;
  responseIntentTone: ResponseIntentTone;
  setResponseIntentTone: React.Dispatch<React.SetStateAction<ResponseIntentTone>>;

  // Autonomy
  setAutonomyLevel: (v: number) => void;
  setAutonomyMode: (v: 'execution' | 'ceo') => void;

  // Browser policy
  setBrowserPolicyConfig: (v: typeof DEFAULT_CONFIG.browser.policy) => void;

  // Keybinding config
  keybindingOverrides: KeybindingOverrides;
  keybindings: KeybindingConfig;

  // Context limit and registered tool count
  setContextLimit: (v: number) => void;
  setRegisteredToolCount: (v: number) => void;

  // Reconnect
  reconnectLmx: () => Promise<void>;
}

export interface UseAppConfigDeps {
  currentModel: string;
  persistenceEnabled: boolean;
  setConnectionState: (v: ConnectionState) => void;
  setCurrentModel: (v: string) => void;
  setAutonomyLevel: (v: number) => void;
  setAutonomyMode: (v: 'execution' | 'ceo') => void;
  setContextLimit: (v: number) => void;
  setRegisteredToolCount: (v: number) => void;
  setBrowserPolicyConfig: (v: typeof DEFAULT_CONFIG.browser.policy) => void;
}

export function useAppConfig(deps: UseAppConfigDeps): UseAppConfigReturn {
  const {
    currentModel,
    persistenceEnabled,
    setConnectionState,
    setCurrentModel,
    setAutonomyLevel,
    setAutonomyMode,
    setContextLimit,
    setRegisteredToolCount,
    setBrowserPolicyConfig,
  } = deps;

  // --- Connection details ---
  const [connectionHost, setConnectionHost] = useState(DEFAULT_CONFIG.connection.host);
  const [connectionFallbackHosts, setConnectionFallbackHosts] = useState<string[]>([]);
  const [connectionPort, setConnectionPort] = useState(1234);
  const [connectionAdminKey, setConnectionAdminKey] = useState<string | undefined>(undefined);
  const [connectionSshUser, setConnectionSshUser] = useState('opta');
  const [connectionSshIdentityFile, setConnectionSshIdentityFile] = useState('~/.ssh/id_ed25519');
  const [connectionSshConnectTimeoutSec, setConnectionSshConnectTimeoutSec] = useState(20);
  const [studioConnectivity, setStudioConnectivity] = useState<StudioConnectivityState>('checking');

  // --- Account ---
  const [accountState, setAccountState] = useState<AccountState | null>(null);

  // --- Trigger/Skill/ResponseIntent ---
  const [triggerDefinitions, setTriggerDefinitions] = useState<TriggerModeDefinition[]>(
    DEFAULT_TRIGGER_MODE_DEFINITIONS
  );
  const [skillRuntimeSettings, setSkillRuntimeSettings] = useState<SkillRuntimeSettings>(
    DEFAULT_SKILL_RUNTIME_SETTINGS
  );
  const [responseIntentTone, setResponseIntentTone] = useState<ResponseIntentTone>(
    DEFAULT_CONFIG.tui.responseIntentTone
  );

  // --- Keybinding overrides ---
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});

  // --- Context limit loading ---
  useEffect(() => {
    import('../../core/models.js')
      .then(({ getContextLimit }) => {
        setContextLimit(getContextLimit(currentModel));
      })
      .catch(() => {});
  }, [currentModel, setContextLimit]);

  // --- Registered tools count loading ---
  useEffect(() => {
    import('../../core/tools/schemas.js')
      .then(({ TOOL_SCHEMAS }) => {
        setRegisteredToolCount(TOOL_SCHEMAS.length);
      })
      .catch(() => {});
  }, [setRegisteredToolCount]);

  // --- Main config loading ---
  useEffect(() => {
    import('../../core/config.js')
      .then(({ loadConfig }) => {
        loadConfig()
          .then((cfg) => {
            setConnectionHost(cfg.connection.host);
            setConnectionFallbackHosts(cfg.connection.fallbackHosts);
            setConnectionPort(cfg.connection.port);
            setConnectionAdminKey(cfg.connection.adminKey);
            setConnectionSshUser(cfg.connection.ssh.user);
            setConnectionSshIdentityFile(cfg.connection.ssh.identityFile);
            setConnectionSshConnectTimeoutSec(cfg.connection.ssh.connectTimeoutSec);
            setAutonomyLevel(cfg.autonomy.level);
            setAutonomyMode(cfg.autonomy.mode);
            setBrowserPolicyConfig(cfg.browser.policy);
            setTriggerDefinitions(
              cfg.tui.triggerModes.length > 0
                ? cfg.tui.triggerModes
                : DEFAULT_TRIGGER_MODE_DEFINITIONS
            );
            setSkillRuntimeSettings({
              dynamicLoading: cfg.tui.skillRuntime.dynamicLoading,
              unloadInactive: cfg.tui.skillRuntime.unloadInactive,
              ttlMinutes: cfg.tui.skillRuntime.ttlMinutes,
              maxActiveSkills: cfg.tui.skillRuntime.maxActiveSkills,
            });
            setResponseIntentTone(cfg.tui.responseIntentTone);
          })
          .catch((err: unknown) => {
            // Log to stderr so failures surface without breaking the Ink render.
            process.stderr.write(
              `[useAppConfig] Failed to apply config: ${err instanceof Error ? err.message : String(err)}\n`
            );
          });
      })
      .catch((err: unknown) => {
        process.stderr.write(
          `[useAppConfig] Failed to import config module: ${err instanceof Error ? err.message : String(err)}\n`
        );
      });
  }, [
    setAutonomyLevel,
    setAutonomyMode,
    setBrowserPolicyConfig,
    setConnectionHost,
    setConnectionFallbackHosts,
    setConnectionPort,
    setConnectionAdminKey,
    setConnectionSshUser,
    setConnectionSshIdentityFile,
    setConnectionSshConnectTimeoutSec,
    setTriggerDefinitions,
    setSkillRuntimeSettings,
    setResponseIntentTone,
  ]);

  // --- Keybindings override loading ---
  useEffect(() => {
    loadKeybindings()
      .then((overrides) => {
        setKeybindingOverrides(overrides);
      })
      .catch(() => {});
  }, []);

  // --- Merged keybindings ---
  const keybindings = useMemo(() => mergeKeybindings(keybindingOverrides), [keybindingOverrides]);

  // --- Load account state on mount (skipped in test environments) ---
  useEffect(() => {
    if (!persistenceEnabled) return;
    import('../../accounts/storage.js')
      .then((mod) => mod.loadAccountState())
      .then((state) => setAccountState(state))
      .catch(() => setAccountState(null));
  }, [persistenceEnabled]);

  // --- 30-second LMX heartbeat — keeps connectionState current ---
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { probeLmxConnection } = await import('../../lmx/connection.js');
        const result = await probeLmxConnection(connectionHost, connectionPort, {
          timeoutMs: 2_000,
        });
        setConnectionState(result.state !== 'disconnected' ? 'connected' : 'error');
      } catch {
        setConnectionState('error');
      }
    };
    const interval = setInterval(() => {
      void checkConnection();
    }, 30_000);
    return () => clearInterval(interval);
  }, [connectionHost, connectionPort, setConnectionState]);

  // --- Studio SSH connectivity check ---
  useEffect(() => {
    if (process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test') {
      setStudioConnectivity('reachable');
      return;
    }

    const hosts = [connectionHost, ...connectionFallbackHosts]
      .map((host) => host.trim())
      .filter((host, index, arr) => host.length > 0 && arr.indexOf(host) === index);
    const remoteHosts = hosts.filter((host) => !isLocalHost(host));

    if (remoteHosts.length === 0) {
      setStudioConnectivity('local');
      return;
    }

    let cancelled = false;
    setStudioConnectivity('checking');

    void (async () => {
      try {
        const { execa } = await import('execa');
        const timeoutSec = Math.max(3, Math.min(120, connectionSshConnectTimeoutSec));
        const identityFile = expandHomePath(connectionSshIdentityFile);

        for (const host of remoteHosts) {
          const args = [
            '-o',
            'BatchMode=yes',
            '-o',
            `ConnectTimeout=${timeoutSec}`,
            '-o',
            'StrictHostKeyChecking=accept-new',
            '-o',
            'NumberOfPasswordPrompts=0',
          ];
          if (identityFile.trim().length > 0) {
            args.push('-i', identityFile);
          }
          args.push(`${connectionSshUser}@${host}`, 'echo opta-ssh-ok');

          const result = await execa('ssh', args, {
            reject: false,
            timeout: (timeoutSec + 5) * 1000,
          });
          if (cancelled) return;
          if (result.exitCode === 0 && result.stdout.includes('opta-ssh-ok')) {
            setStudioConnectivity('reachable');
            return;
          }
        }

        if (!cancelled) {
          setStudioConnectivity('unreachable');
        }
      } catch {
        if (!cancelled) {
          setStudioConnectivity('unreachable');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    connectionHost,
    connectionFallbackHosts,
    connectionSshConnectTimeoutSec,
    connectionSshIdentityFile,
    connectionSshUser,
  ]);

  // --- Reconnect LMX ---
  const reconnectLmx = useCallback(async () => {
    setConnectionState('reconnecting');
    try {
      const { resetProviderCache, probeProvider } = await import('../../providers/manager.js');
      const { loadConfig } = await import('../../core/config.js');
      resetProviderCache();
      const config = await loadConfig();
      const provider = await probeProvider(config);
      setConnectionState('connected');
      const models = await provider.listModels().catch(() => []);
      if (models.length > 0 && models[0]) {
        setCurrentModel(models[0].id);
      }
    } catch {
      setConnectionState('error');
    }
  }, [setConnectionState, setCurrentModel]);

  return {
    connectionHost,
    connectionFallbackHosts,
    connectionPort,
    connectionAdminKey,
    connectionSshUser,
    connectionSshIdentityFile,
    connectionSshConnectTimeoutSec,
    studioConnectivity,
    accountState,
    triggerDefinitions,
    skillRuntimeSettings,
    responseIntentTone,
    setResponseIntentTone,
    setAutonomyLevel,
    setAutonomyMode,
    setBrowserPolicyConfig,
    keybindingOverrides,
    keybindings,
    setContextLimit,
    setRegisteredToolCount,
    reconnectLmx,
  };
}
