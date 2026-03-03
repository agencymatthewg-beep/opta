type Platform = "macos" | "windows";

type ReleaseTarget = {
  manifestUrl: string;
  platformKeys: string[];
  fallbackUrl: string | null;
};

type ProductTarget = {
  name: string;
  description: string;
  platforms: Record<Platform, ReleaseTarget | null>;
};

export const DOWNLOAD_TARGETS: Record<string, ProductTarget> = {
  init: {
    name: "Opta Init Manager",
    description:
      "The core desktop application to orchestrate your local AI stack. Download models, launch tools, and manage the background daemon.",
    platforms: {
      macos: {
        manifestUrl: "/desktop-updates/stable.json",
        platformKeys: ["darwin-aarch64", "darwin-x86_64"],
        fallbackUrl: "/downloads/opta-init/latest/opta-init-mac.dmg",
      },
      windows: {
        manifestUrl: "/desktop-updates/beta.json",
        platformKeys: ["windows-x86_64"],
        fallbackUrl: null,
      },
    },
  },
};

export type DownloadAvailability = {
  url: string | null;
  available: boolean;
  label: string;
  source: "manifest" | "fallback" | "none";
};

export type DownloadAvailabilityMap = Record<
  string,
  {
    name: string;
    description: string;
    macos: DownloadAvailability;
    windows: DownloadAvailability;
  }
>;

type ManagerUpdateFeed = {
  platforms?: Record<string, { url?: string }>;
};

type ManifestAssetResult =
  | { status: "found"; url: string; platformKey: string }
  | { status: "missing" }
  | { status: "unreachable" };

async function findManifestAsset(
  manifestUrl: string,
  platformKeys: string[]
): Promise<ManifestAssetResult> {
  let res: Response;
  try {
    res = await fetch(manifestUrl, { cache: "no-store" });
  } catch {
    return { status: "unreachable" };
  }

  if (!res.ok) return { status: "unreachable" };

  const data = (await res.json()) as ManagerUpdateFeed;
  const platforms = data.platforms ?? {};
  for (const platformKey of platformKeys) {
    const url = platforms[platformKey]?.url;
    if (typeof url === "string" && url.length > 0) {
      return { status: "found", url, platformKey };
    }
  }

  return { status: "missing" };
}

function labelFor(url: string | null, available: boolean) {
  if (!url || !available) return "Coming Soon";
  if (
    url.endsWith(".pkg") ||
    url.endsWith(".dmg") ||
    url.endsWith(".exe") ||
    url.endsWith(".msi") ||
    url.endsWith(".zip")
  )
    return "Installer Ready";
  return "Package Ready";
}

function isInstallerAsset(url: string) {
  return url.endsWith(".pkg") || url.endsWith(".dmg") || url.endsWith(".exe") || url.endsWith(".msi") || url.endsWith(".zip");
}

async function resolvePlatformAvailability(
  target: ReleaseTarget | null
): Promise<DownloadAvailability> {
  if (!target) {
    return {
      url: null,
      available: false,
      label: labelFor(null, false),
      source: "none",
    };
  }

  const release = await findManifestAsset(target.manifestUrl, target.platformKeys);
  if (release.status === "found" && isInstallerAsset(release.url)) {
    return {
      url: release.url,
      available: true,
      label: labelFor(release.url, true),
      source: "manifest",
    };
  }

  if (target.fallbackUrl) {
    return {
      url: target.fallbackUrl,
      available: true,
      label: labelFor(target.fallbackUrl, true),
      source: "fallback",
    };
  }

  return {
    url: null,
    available: false,
    label: labelFor(null, false),
    source: "none",
  };
}

export async function resolveDownloadAvailability(): Promise<DownloadAvailabilityMap> {
  const entries = await Promise.all(
    Object.entries(DOWNLOAD_TARGETS).map(async ([key, target]) => {
      const mac = await resolvePlatformAvailability(target.platforms.macos);
      const windows = await resolvePlatformAvailability(target.platforms.windows);

      return [
        key,
        {
          name: target.name,
          description: target.description,
          macos: mac,
          windows,
        },
      ] as const;
    })
  );

  return Object.fromEntries(entries);
}
