type Platform = "macos" | "windows";

type ReleaseTarget = {
  repo: string;
  patterns: string[];
  fallbackUrl: string | null;
};

type ProductTarget = {
  name: string;
  description: string;
  platforms: Record<Platform, ReleaseTarget | null>;
};

export const DOWNLOAD_TARGETS: Record<string, ProductTarget> = {
  cli: {
    name: "Opta CLI",
    description:
      "Chat with AI models privately on your Mac — visual menus, no commands needed.",
    platforms: {
      macos: {
        repo: "agencymatthewg-beep/opta",
        patterns: ["opta-cli", "npm.tgz", ".tgz", ".pkg"],
        fallbackUrl:
          "https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz",
      },
      windows: null,
    },
  },
  lmx: {
    name: "Opta LMX",
    description:
      "The engine that runs AI models on your Mac's hardware — installs in one click.",
    platforms: {
      macos: {
        repo: "optaops/opta-lmx",
        patterns: ["opta-lmx", "mac", ".pkg", ".dmg"],
        fallbackUrl: "https://github.com/downloads/optaops/opta-lmx/opta-lmx-mac.pkg",
      },
      windows: null,
    },
  },
};

export type DownloadAvailability = {
  url: string | null;
  available: boolean;
  label: string;
  source: "release" | "fallback" | "none";
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

const RELEASE_API = "https://api.github.com/repos";

async function findLatestAsset(repo: string, patterns: string[]) {
  const res = await fetch(`${RELEASE_API}/${repo}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "opta-init-download-check",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    tag_name?: string;
    assets?: Array<{ name: string; browser_download_url: string }>;
  };

  const assets = data.assets ?? [];
  const needle = patterns.map((p) => p.toLowerCase());
  const match =
    assets.find((asset) => {
      const name = asset.name.toLowerCase();
      return needle.every((token) => token.startsWith(".") || name.includes(token));
    }) ??
    assets.find((asset) => {
      const name = asset.name.toLowerCase();
      return needle.some((token) => name.includes(token));
    });

  if (!match) return null;
  return { url: match.browser_download_url, tag: data.tag_name ?? null, name: match.name };
}

function labelFor(url: string | null, available: boolean) {
  if (!url || !available) return "Coming Soon";
  if (url.endsWith(".pkg") || url.endsWith(".dmg")) return "Installer Ready";
  return "Package Ready";
}

export async function resolveDownloadAvailability(): Promise<DownloadAvailabilityMap> {
  const entries = await Promise.all(
    Object.entries(DOWNLOAD_TARGETS).map(async ([key, target]) => {
      const macTarget = target.platforms.macos;
      const winTarget = target.platforms.windows;

      const macRelease = macTarget
        ? await findLatestAsset(macTarget.repo, macTarget.patterns)
        : null;

      const mac = macRelease
        ? {
          url: macRelease.url,
          available: true,
          label: labelFor(macRelease.url, true),
          source: "release" as const,
        }
        : macTarget?.fallbackUrl
          ? {
            url: macTarget.fallbackUrl,
            available: true,
            label: labelFor(macTarget.fallbackUrl, true),
            source: "fallback" as const,
          }
          : {
            url: null,
            available: false,
            label: labelFor(null, false),
            source: "none" as const,
          };

      const windows = winTarget
        ? {
          url: winTarget.fallbackUrl,
          available: Boolean(winTarget.fallbackUrl),
          label: labelFor(winTarget.fallbackUrl, Boolean(winTarget.fallbackUrl)),
          source: winTarget.fallbackUrl ? ("fallback" as const) : ("none" as const),
        }
        : {
          url: null,
          available: false,
          label: "Coming Soon",
          source: "none" as const,
        };

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
