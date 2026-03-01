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
      { title: "Introduction", href: "/docs/getting-started/", description: "What is the Opta Local stack and who is it for" },
      { title: "Installation", href: "/docs/getting-started/installation/", description: "Install and configure the CLI" },
      { title: "LAN Setup", href: "/docs/getting-started/lan-setup/", description: "Connect to your LMX inference server" },
      { title: "First Session", href: "/docs/getting-started/first-session/", description: "Run your first AI chat and do session" },
    ],
  },
  {
    title: "CLI Reference",
    slug: "cli",
    items: [
      { title: "Overview", href: "/docs/cli/", description: "CLI commands at a glance" },
      { title: "Chat & Do", href: "/docs/cli/chat-and-do/", description: "Interactive chat and autonomous task execution" },
      { title: "Model Management", href: "/docs/cli/models/", description: "Load, swap, and browse models" },
      { title: "Sessions", href: "/docs/cli/sessions/", description: "List, export, and manage conversation sessions" },
      { title: "Configuration", href: "/docs/cli/configuration/", description: "Config commands and environment profiles" },
      { title: "Slash Commands", href: "/docs/cli/slash-commands/", description: "In-session slash commands reference" },
    ],
  },
  {
    title: "Daemon",
    slug: "daemon",
    items: [
      { title: "Overview", href: "/docs/daemon/", description: "What the daemon does and why it exists" },
      { title: "Lifecycle", href: "/docs/daemon/lifecycle/", description: "Start, stop, restart, and monitor the daemon" },
      { title: "HTTP API", href: "/docs/daemon/http-api/", description: "REST endpoints for session and operation control" },
      { title: "WebSocket Events", href: "/docs/daemon/websocket/", description: "Real-time event streaming protocol" },
      { title: "Troubleshooting", href: "/docs/daemon/troubleshooting/", description: "Common issues and fixes" },
    ],
  },
  {
    title: "LMX",
    slug: "lmx",
    items: [
      { title: "Overview", href: "/docs/lmx/", description: "The local inference engine for Apple Silicon" },
      { title: "Setup", href: "/docs/lmx/setup/", description: "Install and configure LMX on your Mac Studio" },
      { title: "API Reference", href: "/docs/lmx/api/", description: "OpenAI-compatible inference endpoints" },
      { title: "Model Management", href: "/docs/lmx/models/", description: "Load, unload, and download models" },
      { title: "Monitoring", href: "/docs/lmx/monitoring/", description: "Health checks, VRAM, and throughput metrics" },
    ],
  },
  {
    title: "Local Web",
    slug: "local-web",
    items: [
      { title: "Overview", href: "/docs/local-web/", description: "Browser-based dashboard and chat client" },
      { title: "Dashboard", href: "/docs/local-web/dashboard/", description: "Real-time server monitoring and status" },
      { title: "Chat", href: "/docs/local-web/chat/", description: "Streaming chat interface" },
      { title: "Remote Access", href: "/docs/local-web/remote-access/", description: "Cloudflare Tunnel for WAN access" },
    ],
  },
  {
    title: "Code Desktop",
    slug: "code-desktop",
    items: [
      { title: "Overview", href: "/docs/code-desktop/", description: "Visual session monitor for daemon activity" },
      { title: "Session Management", href: "/docs/code-desktop/sessions/", description: "View and manage daemon sessions" },
      { title: "Daemon Controls", href: "/docs/code-desktop/daemon-controls/", description: "Start, stop, and monitor the daemon from the UI" },
    ],
  },
  {
    title: "Browser Automation",
    slug: "browser-automation",
    items: [
      { title: "Overview", href: "/docs/browser-automation/", description: "AI-driven browser control via Playwright" },
      { title: "Tools", href: "/docs/browser-automation/tools/", description: "Available browser tools and actions" },
      { title: "Recording & Replay", href: "/docs/browser-automation/recording/", description: "Session recording and visual diff" },
    ],
  },
  {
    title: "Security",
    slug: "security",
    items: [
      { title: "Overview", href: "/docs/security/", description: "Security model and design principles" },
      { title: "Permissions", href: "/docs/security/permissions/", description: "Tool permissions and approval workflow" },
      { title: "Privacy", href: "/docs/security/privacy/", description: "Local-first privacy guarantees" },
      { title: "Guardrails", href: "/docs/security/guardrails/", description: "Safety rules and hard stops" },
    ],
  },
  {
    title: "Developer Guide",
    slug: "developer",
    items: [
      { title: "Overview", href: "/docs/developer/", description: "Building on the Opta Local stack" },
      { title: "MCP Integration", href: "/docs/developer/mcp/", description: "Model Context Protocol servers and tools" },
      { title: "Daemon Client SDK", href: "/docs/developer/sdk/", description: "TypeScript client for daemon integration" },
      { title: "API Authentication", href: "/docs/developer/auth/", description: "Token management and auth flows" },
    ],
  },
  {
    title: "Feature Status",
    slug: "feature-status",
    items: [
      { title: "Status Board", href: "/docs/feature-status/", description: "Current feature implementation status" },
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
