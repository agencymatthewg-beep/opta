import type { ManagedWebsite, WebsiteHealthSnapshot, WebsiteRuntimeStatus } from './types';
import websitesRegistry from './websites.registry.generated.json';

const REQUEST_TIMEOUT_MS = 6_500;

type CanonicalWebsiteRecord = {
  key: string;
  name: string;
  domain: string;
  localUrl: string;
  healthPath: string;
  appPath: string;
  purpose?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readCanonicalManagedWebsites(): ManagedWebsite[] {
  const websites = Array.isArray(websitesRegistry.websites) ? websitesRegistry.websites : [];

  return websites
    .filter((website): website is CanonicalWebsiteRecord => {
      return (
        website != null &&
        isNonEmptyString(website.key) &&
        isNonEmptyString(website.name) &&
        isNonEmptyString(website.domain) &&
        isNonEmptyString(website.localUrl) &&
        isNonEmptyString(website.healthPath) &&
        isNonEmptyString(website.appPath)
      );
    })
    .map((website) => ({
      key: website.key,
      name: website.name,
      domain: website.domain,
      path: website.appPath,
      purpose:
        website.purpose?.trim() || `${website.name} operational surface`,
      localUrl: website.localUrl,
      healthPath: website.healthPath,
    }));
}

export const MANAGED_WEBSITES: ManagedWebsite[] = readCanonicalManagedWebsites();

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
