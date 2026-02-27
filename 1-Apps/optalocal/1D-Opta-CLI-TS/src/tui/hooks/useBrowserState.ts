import { useState } from 'react';
import { DEFAULT_BROWSER_PROFILE_RETENTION_POLICY } from '../../browser/profile-store.js';
import { DEFAULT_CONFIG } from '../../core/config.js';
import type { BrowserPendingApprovalItem } from '../BrowserControlOverlay.js';
import type { BrowserApprovalEvent } from '../../browser/approval-log.js';
import type { BrowserRuntimeHealth } from '../../browser/runtime-daemon.js';
import type { BrowserSessionMetadata, BrowserSessionStepRecord } from '../../browser/types.js';
import type { BrowserReplayStepArtifactPreview, BrowserReplayVisualDiffPair } from '../../browser/replay.js';
import type { ActionEventStatus } from '../activity.js';

interface BrowserControlPaneState {
  loading: boolean;
  health: BrowserRuntimeHealth | null;
  approvals: BrowserApprovalEvent[];
  message: string;
  messageStatus: ActionEventStatus;
  lastAction: import('../../browser/control-surface.js').BrowserControlAction;
  profileRetentionDays: number;
  profileMaxPersistedProfiles: number;
  profilePersistedCount: number;
}

interface BrowserReplayPaneState {
  loading: boolean;
  selectedSessionId: string | null;
  metadata: BrowserSessionMetadata | null;
  steps: BrowserSessionStepRecord[];
  selectedStepIndex: number;
  stepPreview: BrowserReplayStepArtifactPreview | null;
  visualDiffs: BrowserReplayVisualDiffPair[];
  selectedDiffIndex: number;
  message: string;
  messageStatus: ActionEventStatus;
}

export interface UseBrowserStateReturn {
  browserControlPane: BrowserControlPaneState;
  setBrowserControlPane: React.Dispatch<React.SetStateAction<BrowserControlPaneState>>;
  pendingBrowserApprovals: BrowserPendingApprovalItem[];
  setPendingBrowserApprovals: React.Dispatch<React.SetStateAction<BrowserPendingApprovalItem[]>>;
  browserPolicyConfig: typeof DEFAULT_CONFIG.browser.policy;
  setBrowserPolicyConfig: (v: typeof DEFAULT_CONFIG.browser.policy) => void;
  browserReplayPane: BrowserReplayPaneState;
  setBrowserReplayPane: React.Dispatch<React.SetStateAction<BrowserReplayPaneState>>;
}

export function useBrowserState(): UseBrowserStateReturn {
  const [browserControlPane, setBrowserControlPane] = useState<BrowserControlPaneState>({
    loading: false,
    health: null,
    approvals: [],
    message: 'Press 1 to start · 2 pause · 3 resume · 4 stop · 5 kill · X prune · Ctrl+R refresh.',
    messageStatus: 'info',
    lastAction: 'status',
    profileRetentionDays: DEFAULT_BROWSER_PROFILE_RETENTION_POLICY.retentionDays,
    profileMaxPersistedProfiles: DEFAULT_BROWSER_PROFILE_RETENTION_POLICY.maxPersistedProfiles,
    profilePersistedCount: 0,
  });

  const [pendingBrowserApprovals, setPendingBrowserApprovals] = useState<BrowserPendingApprovalItem[]>([]);

  const [browserPolicyConfig, setBrowserPolicyConfig] = useState(DEFAULT_CONFIG.browser.policy);

  const [browserReplayPane, setBrowserReplayPane] = useState<BrowserReplayPaneState>({
    loading: false,
    selectedSessionId: null,
    metadata: null,
    steps: [],
    selectedStepIndex: 0,
    stepPreview: null,
    visualDiffs: [],
    selectedDiffIndex: 0,
    message: 'Select a session id, then press Enter to load replay steps.',
    messageStatus: 'info',
  });

  return {
    browserControlPane,
    setBrowserControlPane,
    pendingBrowserApprovals,
    setPendingBrowserApprovals,
    browserPolicyConfig,
    setBrowserPolicyConfig,
    browserReplayPane,
    setBrowserReplayPane,
  };
}
