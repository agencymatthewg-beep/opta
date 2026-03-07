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

// Latest Opta Init Manager — stable v0.7.3 (2026-03-07)
const INIT_VERSION = "0.7.3";
const INIT_MACOS_INSTALLER_ENDPOINT = "/downloads/opta-init/latest/opta-init-mac.dmg";
const INIT_WINDOWS_INSTALLER_ENDPOINT = "/downloads/opta-init/latest/opta-init-windows-x64.exe";

// Latest Opta CLI — v0.5.0-alpha.15 (2026-03-01)
const CLI_VERSION = "0.5.0-alpha.15";
const CLI_INSTALLER_ENDPOINT = "/downloads/opta-cli/latest";

// Latest Opta Code Desktop — v0.2.2 (2026-03-07)
const CODE_VERSION = "0.2.2";
const CODE_MACOS_INSTALLER_ENDPOINT = "https://github.com/agencymatthewg-beep/opta/releases/download/v0.2.2/Opta.Code.Desktop.Universal_0.2.2_aarch64.dmg";
const CODE_WINDOWS_INSTALLER_ENDPOINT = "https://github.com/agencymatthewg-beep/opta/releases/download/v0.2.2/Opta.Code.Desktop.Universal_0.2.2_x64-setup.exe";

export const DOWNLOAD_TARGETS: Record<string, ProductTarget> = {
  init: {
    name: "Opta Init Manager",
    description:
      "The core desktop application to orchestrate your local AI stack. Download models, launch tools, and manage the background daemon.",
    platforms: {
      macos: {
        manifestUrl: "/desktop-updates/stable.json",
        // darwin-aarch64 first (Apple Silicon), fallback to darwin-x86_64 (Intel)
        platformKeys: ["darwin-aarch64", "darwin-x86_64"],
        fallbackUrl: INIT_MACOS_INSTALLER_ENDPOINT,
      },
      windows: {
        manifestUrl: "/desktop-updates/stable.json",
        platformKeys: ["windows-x86_64"],
        fallbackUrl: INIT_WINDOWS_INSTALLER_ENDPOINT,
      },
    },
  },

  code: {
    name: "Opta Code Desktop",
    description:
      "The premium AI coding assistant desktop app. Chat, plan, and run autonomous workflows with local or cloud models — built on Tauri v2 with glassmorphic UI.",
    platforms: {
      macos: {
        manifestUrl: "/desktop/manifest-stable.json",
        platformKeys: [],
        fallbackUrl: CODE_MACOS_INSTALLER_ENDPOINT,
      },
      windows: {
        manifestUrl: "/desktop/manifest-stable.json",
        platformKeys: [],
        fallbackUrl: CODE_WINDOWS_INSTALLER_ENDPOINT,
      },
    },
  },

  cli: {
    name: "Opta CLI (npm package)",
    description:
      "Install the Opta CLI directly via npm for terminal-first control, daemon management, and AI provider configuration.",
    platforms: {
      macos: {
        manifestUrl: "/desktop-updates/stable.json",
        platformKeys: [],
        fallbackUrl: CLI_INSTALLER_ENDPOINT,
      },
      windows: {
        manifestUrl: "/desktop-updates/stable.json",
        platformKeys: [],
        fallbackUrl: CLI_INSTALLER_ENDPOINT,
      },
    },
  },
};


export type DownloadAvailability = {
  url: string | null;
  available: boolean;
  label: string;
  source: "manifest" | "fallback" | "none";
  version?: string;
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
  version?: string;
  platforms?: Record<string, { url?: string }>;
};

type ManifestAssetResult =
  | { status: "found"; url: string; platformKey: string; version?: string }
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
  const version = typeof data.version === "string" ? data.version : undefined;

  for (const platformKey of platformKeys) {
    const url = platforms[platformKey]?.url;
    if (typeof url === "string" && url.length > 0) {
      return { status: "found", url, platformKey, version };
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
  // .nsis.zip is the Tauri updater bundle (consumed by the in-app updater), not a user-facing installer
  if (url.endsWith(".nsis.zip")) return false;
  return url.endsWith(".pkg") || url.endsWith(".dmg") || url.endsWith(".exe") || url.endsWith(".msi") || url.endsWith(".zip");
}

async function resolvePlatformAvailability(
  target: ReleaseTarget | null,
  fallbackVersion: string,
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
      version: release.version,
    };
  }

  // When the manifest was reachable and returned a version (even if the asset
  // URL is not a user-facing installer, e.g. .app.tar.gz updater bundles),
  // prefer the manifest version over the hardcoded fallback constant so the
  // download button always reflects the latest published release.
  const bestVersion =
    release.status === "found" && release.version
      ? release.version
      : fallbackVersion;

  if (target.fallbackUrl) {
    return {
      url: target.fallbackUrl,
      available: true,
      label: labelFor(target.fallbackUrl, true),
      source: "fallback",
      version: bestVersion,
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
  const versionMap: Record<string, string> = {
    init: INIT_VERSION,
    code: CODE_VERSION,
    cli: CLI_VERSION,
  };

  const entries = await Promise.all(
    Object.entries(DOWNLOAD_TARGETS).map(async ([key, target]) => {
      const fallbackVersion = versionMap[key] ?? "";
      const mac = await resolvePlatformAvailability(target.platforms.macos, fallbackVersion);
      const windows = await resolvePlatformAvailability(target.platforms.windows, fallbackVersion);

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
