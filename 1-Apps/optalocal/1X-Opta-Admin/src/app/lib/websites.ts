import type { ManagedWebsite, WebsiteHealthSnapshot, WebsiteRuntimeStatus } from './types';

const REQUEST_TIMEOUT_MS = 6_500;

export const MANAGED_WEBSITES: ManagedWebsite[] = [
  {
    key: 'home',
    name: 'Opta Home',
    domain: 'optalocal.com',
    path: '1T-Opta-Home',
    purpose: 'Primary ecosystem landing surface',
    localUrl: 'http://localhost:3000',
    healthPath: '/',
  },
  {
    key: 'init',
    name: 'Opta Init',
    domain: 'init.optalocal.com',
    path: '1O-Opta-Init',
    purpose: 'Distribution + update metadata control plane',
    localUrl: 'http://localhost:3001',
    healthPath: '/',
  },
  {
    key: 'accounts',
    name: 'Opta Accounts',
    domain: 'accounts.optalocal.com',
    path: '1R-Opta-Accounts',
    purpose: 'Identity, session, and account access management',
    localUrl: 'http://localhost:3002',
    healthPath: '/api/health/supabase',
  },
  {
    key: 'status',
    name: 'Opta Status',
    domain: 'status.optalocal.com',
    path: '1S-Opta-Status',
    purpose: 'Public health and release-state visibility',
    localUrl: 'http://localhost:3005',
    healthPath: '/',
  },
  {
    key: 'help',
    name: 'Opta Help',
    domain: 'help.optalocal.com',
    path: '1U-Opta-Help',
    purpose: 'Support docs and implementation references',
    localUrl: 'http://localhost:3006',
    healthPath: '/',
  },
  {
    key: 'learn',
    name: 'Opta Learn',
    domain: 'learn.optalocal.com',
    path: '1V-Opta-Learn',
    purpose: 'Guide inventory and learning pipeline',
    localUrl: 'http://localhost:3007',
    healthPath: '/',
  },
  {
    key: 'admin',
    name: 'Opta Admin',
    domain: 'admin.optalocal.com',
    path: '1X-Opta-Admin',
    purpose: 'Private website operations cockpit',
    localUrl: 'http://localhost:3008',
    healthPath: '/',
  },
];

async function probe(url: string): Promise<WebsiteRuntimeStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.ok) return 'online';
    if (response.status === 401 || response.status === 403) return 'online';
    if (response.status >= 500) return 'offline';
    return 'degraded';
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkManagedWebsiteHealth(
  website: ManagedWebsite
): Promise<WebsiteHealthSnapshot> {
  const [localStatus, productionStatus] = await Promise.all([
    probe(`${website.localUrl}${website.healthPath}`),
    probe(`https://${website.domain}${website.healthPath}`),
  ]);

  return {
    ...website,
    checkedAt: new Date().toISOString(),
    localStatus,
    productionStatus,
  };
}
