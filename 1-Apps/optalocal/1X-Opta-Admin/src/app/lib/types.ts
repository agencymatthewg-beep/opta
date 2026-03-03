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
