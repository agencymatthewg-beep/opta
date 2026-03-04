export type GuideStatus = 'verified' | 'draft';

export interface GuideSection {
  heading: string;
  body: string;
  visual?: string;
  note?: string;
  code?: string;
}

export interface GuideRecord {
  slug: string;
  title: string;
  summary: string;
  updatedAt?: string;
  status: GuideStatus;
  app?: string;
  category?: string;
  sections: GuideSection[];
  file?: string;
}

export interface GuideManifestEntry {
  slug: string;
  title: string;
  file: string;
  exportName: string;
  status: GuideStatus;
}

export interface GuidesManifest {
  published: GuideManifestEntry[];
  draft: GuideManifestEntry[];
}

export interface PromotionPolicy {
  allowAll: boolean;
  allowedSlugs: string[];
}

export interface PromoteNextStep {
  title: string;
  detail: string;
  command?: string;
  url?: string;
}

export type PromoteOutcome = 'promoted' | 'action_required' | 'blocked' | 'error';
export type PromoteMode = 'local' | 'fallback';

export interface PromoteApiResponse {
  outcome: PromoteOutcome;
  mode: PromoteMode;
  promoted: boolean;
  requestId?: string;
  slug?: string;
  message: string;
  nextSteps?: PromoteNextStep[];
  policy?: PromotionPolicy;
  error?: string;
}

export type WebsiteRuntimeStatus = 'online' | 'degraded' | 'offline';

export interface ManagedWebsite {
  key: string;
  name: string;
  domain: string;
  path: string;
  purpose: string;
  localUrl: string;
  healthPath: string;
}

export interface WebsiteHealthSnapshot extends ManagedWebsite {
  checkedAt: string;
  localStatus: WebsiteRuntimeStatus;
  productionStatus: WebsiteRuntimeStatus;
}

export type AdminAuditAction = 'guide.promote';
export type AdminAuditOutcome = 'attempt' | 'success' | 'failure';

export interface AdminAuditEntry {
  id: string;
  action: AdminAuditAction;
  outcome: AdminAuditOutcome;
  slug?: string;
  message: string;
  requestId: string;
  createdAt: string;
}

export type StatusIntegrationState =
  | WebsiteRuntimeStatus
  | 'checking'
  | 'unconfigured'
  | 'unknown';

export interface AdminStatusProbe {
  source: string;
  url?: string;
  status: StatusIntegrationState;
  latencyMs?: number;
  checkedAt: string;
  error?: string;
}

export interface AdminFeatureRegistrySnapshot {
  source: string;
  generatedAt?: string;
  complete?: number;
  pending?: number;
  total?: number;
  completion?: string;
  risk?: string;
  topGaps: string[];
  error?: string;
}

export interface AdminOpsSnapshot {
  generatedAt: string;
  actions: AdminAuditEntry[];
  statusProbe: AdminStatusProbe;
  featureRegistry: AdminFeatureRegistrySnapshot;
}
