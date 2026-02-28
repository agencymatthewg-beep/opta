export const DAEMON_API_CONTRACT = 'opta-daemon-v3' as const;
export const DAEMON_API_CONTRACT_VERSION = 1 as const;

export interface DaemonContractDescriptor {
  name: typeof DAEMON_API_CONTRACT;
  version: number;
}

export interface DaemonContractMismatch {
  expected: DaemonContractDescriptor;
  actual: {
    name?: unknown;
    version?: unknown;
  };
}

export interface DaemonHealthLike {
  daemonId?: unknown;
  contract?: {
    name?: unknown;
    version?: unknown;
  };
}

export function expectedDaemonContract(): DaemonContractDescriptor {
  return {
    name: DAEMON_API_CONTRACT,
    version: DAEMON_API_CONTRACT_VERSION,
  };
}

export function validateDaemonContract(health: DaemonHealthLike): DaemonContractMismatch | null {
  const contract = health.contract;
  if (!contract) {
    return {
      expected: expectedDaemonContract(),
      actual: {},
    };
  }

  const nameMatches = contract.name === DAEMON_API_CONTRACT;
  const versionMatches = contract.version === DAEMON_API_CONTRACT_VERSION;

  if (nameMatches && versionMatches) return null;

  return {
    expected: expectedDaemonContract(),
    actual: {
      name: contract.name,
      version: contract.version,
    },
  };
}
