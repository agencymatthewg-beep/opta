export interface NavItem {
  title: string;
  href: string;
  description?: string;
}

export interface NavSection {
  title: string;
  slug: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: "Getting Started",
    slug: "getting-started",
    items: [
      { title: "Introduction", href: "/docs/getting-started/", description: "System orientation, operating model, and production fit" },
      { title: "Installation", href: "/docs/getting-started/installation/", description: "Install Opta CLI with verified runtime prerequisites" },
      { title: "LAN Setup", href: "/docs/getting-started/lan-setup/", description: "Bind your workstation to the LMX inference endpoint" },
      { title: "First Session", href: "/docs/getting-started/first-session/", description: "Execute your first guided and autonomous workflows" },
    ],
  },
  {
    title: "Ecosystem",
    slug: "ecosystem",
    items: [
      { title: "Overview", href: "/docs/ecosystem/", description: "Runtime topology, interfaces, and ownership boundaries" },
      { title: "Synergies", href: "/docs/ecosystem/synergies/", description: "Cross-surface behavior, coupling points, and leverage" },
      { title: "Change Impact", href: "/docs/ecosystem/change-impact/", description: "Impact modeling and controlled-change discipline" },
    ],
  },
  {
    title: "Accounts",
    slug: "accounts",
    items: [
      { title: "Overview", href: "/docs/accounts/", description: "Identity architecture, SSO posture, and access control" },
      { title: "Auth", href: "/docs/accounts/auth/", description: "Auth flow, token handling, and session contracts" },
      { title: "Sync", href: "/docs/accounts/sync/", description: "Data synchronization scope, boundaries, and governance" },
      { title: "Troubleshooting", href: "/docs/accounts/troubleshooting/", description: "Authentication and session incident playbooks" },
    ],
  },
  {
    title: "CLI Reference",
    slug: "cli",
    items: [
      { title: "Overview", href: "/docs/cli/", description: "Command surface, lifecycle semantics, and platform support" },
      { title: "Chat & Do", href: "/docs/cli/chat-and-do/", description: "Interactive execution and autonomous operator flows" },
      { title: "Model Management", href: "/docs/cli/models/", description: "Model catalog operations and runtime selection" },
      { title: "Sessions", href: "/docs/cli/sessions/", description: "Session durability, export controls, and recovery paths" },
      { title: "Configuration", href: "/docs/cli/configuration/", description: "Configuration contracts and environment profiles" },
      { title: "Slash Commands", href: "/docs/cli/slash-commands/", description: "In-session command grammar and advanced controls" },
    ],
  },
  {
    title: "Daemon",
    slug: "daemon",
    items: [
      { title: "Overview", href: "/docs/daemon/", description: "Control plane role, guarantees, and execution boundaries" },
      { title: "Lifecycle", href: "/docs/daemon/lifecycle/", description: "Lifecycle orchestration, service install, and recovery" },
      { title: "HTTP API", href: "/docs/daemon/http-api/", description: "Session and operation API contracts over HTTP v3" },
      { title: "WebSocket Events", href: "/docs/daemon/websocket/", description: "Streaming event protocol and state transitions" },
      { title: "Troubleshooting", href: "/docs/daemon/troubleshooting/", description: "Failure diagnostics and deterministic remediation" },
    ],
  },
  {
    title: "LMX",
    slug: "lmx",
    items: [
      { title: "Overview", href: "/docs/lmx/", description: "Local inference runtime architecture for Apple Silicon" },
      { title: "Setup", href: "/docs/lmx/setup/", description: "Provision and harden the LMX host environment" },
      { title: "API Reference", href: "/docs/lmx/api/", description: "OpenAI-compatible endpoint specification and usage" },
      { title: "Model Management", href: "/docs/lmx/models/", description: "Model lifecycle operations and memory strategy" },
      { title: "Monitoring", href: "/docs/lmx/monitoring/", description: "Health telemetry, VRAM discipline, and throughput" },
      { title: "Voice & Audio", href: "/docs/lmx/voice/", description: "Voice pipeline operations using mlx-whisper and mlx-audio" },
    ],
  },
  {
    title: "Local Web",
    slug: "local-web",
    items: [
      { title: "Overview", href: "/docs/local-web/", description: "Browser control surface for local operations" },
      { title: "Dashboard", href: "/docs/local-web/dashboard/", description: "Real-time runtime telemetry and health posture" },
      { title: "Chat", href: "/docs/local-web/chat/", description: "Streaming conversational execution in browser" },
      { title: "Remote Access", href: "/docs/local-web/remote-access/", description: "Controlled WAN reachability via Cloudflare Tunnel" },
    ],
  },
  {
    title: "Code Desktop",
    slug: "code-desktop",
    items: [
      { title: "Overview", href: "/docs/code-desktop/", description: "Desktop operator surface for session orchestration" },
      { title: "Session Management", href: "/docs/code-desktop/sessions/", description: "Session visibility, control, and forensic context" },
      { title: "Daemon Controls", href: "/docs/code-desktop/daemon-controls/", description: "Lifecycle controls and daemon observability in-app" },
    ],
  },
  {
    title: "Browser Automation",
    slug: "browser-automation",
    items: [
      { title: "Overview", href: "/docs/browser-automation/", description: "Agentic browser control stack powered by Playwright" },
      { title: "Tools", href: "/docs/browser-automation/tools/", description: "Tool surface, action contracts, and safety boundaries" },
      { title: "Recording & Replay", href: "/docs/browser-automation/recording/", description: "Replay workflows and visual regression evidence" },
    ],
  },
  {
    title: "Status",
    slug: "status",
    items: [
      { title: "Overview", href: "/docs/status/", description: "Fleet status interpretation and incident context" },
      { title: "Service Cards", href: "/docs/status/service-cards/", description: "Health semantics, severity bands, and triage signals" },
      { title: "Releases", href: "/docs/status/releases/", description: "Release streams, rollout state, and deployment context" },
      { title: "Feature Registry", href: "/docs/status/feature-registry/", description: "Feature-state governance and drift detection" },
    ],
  },
  {
    title: "Security",
    slug: "security",
    items: [
      { title: "Overview", href: "/docs/security/", description: "Security architecture and trust boundaries" },
      { title: "Permissions", href: "/docs/security/permissions/", description: "Permission controls and approval governance" },
      { title: "Privacy", href: "/docs/security/privacy/", description: "Local-first privacy model and data handling guarantees" },
      { title: "Guardrails", href: "/docs/security/guardrails/", description: "Safety policies, hard stops, and operator controls" },
    ],
  },
  {
    title: "Developer Guide",
    slug: "developer",
    items: [
      { title: "Overview", href: "/docs/developer/", description: "Integration patterns for building on Opta Local" },
      { title: "MCP Integration", href: "/docs/developer/mcp/", description: "MCP server integration and tool contract design" },
      { title: "Daemon Client SDK", href: "/docs/developer/sdk/", description: "TypeScript daemon client patterns and contracts" },
      { title: "API Authentication", href: "/docs/developer/auth/", description: "Token lifecycle management and auth flows" },
    ],
  },
  {
    title: "Support",
    slug: "support",
    items: [
      { title: "FAQ", href: "/docs/support/faq/", description: "Operational answers for high-frequency setup questions" },
    ],
  },
  {
    title: "Feature Status",
    slug: "feature-status",
    items: [
      { title: "Status Board", href: "/docs/feature-status/", description: "Current implementation state across Opta surfaces" },
    ],
  },
];

export function findSection(slug: string): NavSection | undefined {
  return navigation.find(s => s.slug === slug);
}

export function findItem(href: string): { section: NavSection; item: NavItem; index: number } | undefined {
  for (const section of navigation) {
    const index = section.items.findIndex(i => i.href === href);
    if (index !== -1) {
      return { section, item: section.items[index], index };
    }
  }
  return undefined;
}

export function getAllPages(): NavItem[] {
  return navigation.flatMap(s => s.items);
}

export function getPrevNext(href: string): { prev?: NavItem; next?: NavItem } {
  const all = getAllPages();
  const index = all.findIndex(p => p.href === href);
  if (index === -1) return {};
  return {
    prev: index > 0 ? all[index - 1] : undefined,
    next: index < all.length - 1 ? all[index + 1] : undefined,
  };
}
