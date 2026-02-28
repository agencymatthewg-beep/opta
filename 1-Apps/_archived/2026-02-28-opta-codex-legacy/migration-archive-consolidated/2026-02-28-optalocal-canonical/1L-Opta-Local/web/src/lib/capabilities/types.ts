export const CAPABILITY_PARITY_CATEGORIES = [
  'in_dashboard',
  'in_lmx_not_dashboard',
  'dashboard_only',
] as const;

export type CapabilityParityCategory =
  (typeof CAPABILITY_PARITY_CATEGORIES)[number];

export interface CapabilityParityEntry {
  path: string;
  category: CapabilityParityCategory;
}

export interface CapabilityParityByCategory {
  in_dashboard: string[];
  in_lmx_not_dashboard: string[];
  dashboard_only: string[];
}

export interface CapabilityParityArtifact {
  categories: readonly CapabilityParityCategory[];
  endpoints: CapabilityParityEntry[];
  byCategory: CapabilityParityByCategory;
  sources: {
    lmxApiDir: string;
    dashboardClientPath: string;
  };
}
