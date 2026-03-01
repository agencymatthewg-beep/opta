export const searchData = [
  // Getting Started
  { title: "Introduction", href: "/docs/getting-started/", section: "Getting Started", description: "What is the Opta Local stack and who is it for", keywords: ["overview", "what is opta", "architecture", "components"] },
  { title: "Installation", href: "/docs/getting-started/installation/", section: "Getting Started", description: "Install and configure the CLI", keywords: ["install", "npm", "setup", "download"] },
  { title: "LAN Setup", href: "/docs/getting-started/lan-setup/", section: "Getting Started", description: "Connect to your LMX inference server", keywords: ["lan", "network", "mac studio", "connection", "host", "ip"] },
  { title: "First Session", href: "/docs/getting-started/first-session/", section: "Getting Started", description: "Run your first AI chat and do session", keywords: ["chat", "do", "first", "tutorial", "quickstart"] },

  // CLI
  { title: "CLI Overview", href: "/docs/cli/", section: "CLI Reference", description: "CLI commands at a glance", keywords: ["cli", "commands", "terminal", "opta"] },
  { title: "Chat & Do", href: "/docs/cli/chat-and-do/", section: "CLI Reference", description: "Interactive chat and autonomous task execution", keywords: ["chat", "do", "conversation", "autonomous", "agent"] },
  { title: "Model Management", href: "/docs/cli/models/", section: "CLI Reference", description: "Load, swap, and browse models", keywords: ["models", "load", "swap", "browse", "library", "deepseek", "qwen"] },
  { title: "Sessions", href: "/docs/cli/sessions/", section: "CLI Reference", description: "List, export, and manage sessions", keywords: ["sessions", "history", "export", "delete", "list"] },
  { title: "Configuration", href: "/docs/cli/configuration/", section: "CLI Reference", description: "Config commands and environment profiles", keywords: ["config", "settings", "env", "profiles", "preferences"] },
  { title: "Slash Commands", href: "/docs/cli/slash-commands/", section: "CLI Reference", description: "In-session slash commands", keywords: ["slash", "commands", "help", "model", "plan", "review", "commit"] },

  // Daemon
  { title: "Daemon Overview", href: "/docs/daemon/", section: "Daemon", description: "What the daemon does and why it exists", keywords: ["daemon", "background", "orchestration", "session"] },
  { title: "Daemon Lifecycle", href: "/docs/daemon/lifecycle/", section: "Daemon", description: "Start, stop, restart, and monitor", keywords: ["start", "stop", "restart", "status", "logs", "pid"] },
  { title: "HTTP API", href: "/docs/daemon/http-api/", section: "Daemon", description: "REST endpoints for session control", keywords: ["http", "api", "rest", "endpoints", "v3", "sessions"] },
  { title: "WebSocket Events", href: "/docs/daemon/websocket/", section: "Daemon", description: "Real-time event streaming protocol", keywords: ["websocket", "ws", "events", "streaming", "turn", "token"] },
  { title: "Daemon Troubleshooting", href: "/docs/daemon/troubleshooting/", section: "Daemon", description: "Common issues and fixes", keywords: ["troubleshooting", "errors", "debug", "port", "crash"] },

  // LMX
  { title: "LMX Overview", href: "/docs/lmx/", section: "LMX", description: "The local inference engine", keywords: ["lmx", "inference", "mlx", "apple silicon", "local"] },
  { title: "LMX Setup", href: "/docs/lmx/setup/", section: "LMX", description: "Install and configure LMX", keywords: ["setup", "install", "python", "venv", "launchd"] },
  { title: "LMX API Reference", href: "/docs/lmx/api/", section: "LMX", description: "OpenAI-compatible endpoints", keywords: ["api", "openai", "chat", "completions", "streaming"] },
  { title: "LMX Model Management", href: "/docs/lmx/models/", section: "LMX", description: "Load, unload, and download models", keywords: ["models", "load", "unload", "download", "huggingface", "gguf"] },
  { title: "LMX Monitoring", href: "/docs/lmx/monitoring/", section: "LMX", description: "Health checks and metrics", keywords: ["health", "monitoring", "vram", "memory", "throughput"] },

  // Local Web
  { title: "Local Web Overview", href: "/docs/local-web/", section: "Local Web", description: "Browser-based dashboard and chat", keywords: ["web", "dashboard", "browser", "local"] },
  { title: "Dashboard", href: "/docs/local-web/dashboard/", section: "Local Web", description: "Real-time server monitoring", keywords: ["dashboard", "vram", "models", "throughput", "gauge"] },
  { title: "Chat Interface", href: "/docs/local-web/chat/", section: "Local Web", description: "Streaming chat interface", keywords: ["chat", "streaming", "conversation", "web"] },
  { title: "Remote Access", href: "/docs/local-web/remote-access/", section: "Local Web", description: "Cloudflare Tunnel for WAN access", keywords: ["remote", "wan", "cloudflare", "tunnel", "phone"] },

  // Code Desktop
  { title: "Code Desktop Overview", href: "/docs/code-desktop/", section: "Code Desktop", description: "Visual session monitor", keywords: ["desktop", "electron", "vite", "monitor"] },
  { title: "Session Management", href: "/docs/code-desktop/sessions/", section: "Code Desktop", description: "View and manage daemon sessions", keywords: ["sessions", "timeline", "workspace", "cards"] },
  { title: "Daemon Controls", href: "/docs/code-desktop/daemon-controls/", section: "Code Desktop", description: "Daemon lifecycle from the UI", keywords: ["daemon", "start", "stop", "logs", "controls"] },

  // Browser Automation
  { title: "Browser Automation", href: "/docs/browser-automation/", section: "Browser Automation", description: "AI-driven browser control", keywords: ["browser", "playwright", "automation", "navigate"] },
  { title: "Browser Tools", href: "/docs/browser-automation/tools/", section: "Browser Automation", description: "Available browser actions", keywords: ["tools", "click", "type", "screenshot", "navigate"] },
  { title: "Recording & Replay", href: "/docs/browser-automation/recording/", section: "Browser Automation", description: "Session recording and visual diff", keywords: ["recording", "replay", "visual", "diff", "screenshot"] },

  // Security
  { title: "Security Overview", href: "/docs/security/", section: "Security", description: "Security model and principles", keywords: ["security", "safety", "model", "design"] },
  { title: "Permissions", href: "/docs/security/permissions/", section: "Security", description: "Tool permissions and approval", keywords: ["permissions", "approval", "allow", "deny", "tools"] },
  { title: "Privacy", href: "/docs/security/privacy/", section: "Security", description: "Local-first privacy guarantees", keywords: ["privacy", "local", "data", "cloud", "opt-in"] },
  { title: "Guardrails", href: "/docs/security/guardrails/", section: "Security", description: "Safety rules and hard stops", keywords: ["guardrails", "rules", "critical", "strict", "safety"] },

  // Developer
  { title: "Developer Overview", href: "/docs/developer/", section: "Developer Guide", description: "Building on the Opta stack", keywords: ["developer", "build", "integrate", "extend"] },
  { title: "MCP Integration", href: "/docs/developer/mcp/", section: "Developer Guide", description: "Model Context Protocol", keywords: ["mcp", "protocol", "servers", "tools", "integration"] },
  { title: "Daemon Client SDK", href: "/docs/developer/sdk/", section: "Developer Guide", description: "TypeScript client library", keywords: ["sdk", "client", "typescript", "library", "package"] },
  { title: "API Authentication", href: "/docs/developer/auth/", section: "Developer Guide", description: "Token management and auth flows", keywords: ["auth", "authentication", "token", "bearer", "keychain"] },

  // Feature Status
  { title: "Feature Status Board", href: "/docs/feature-status/", section: "Feature Status", description: "Current implementation status", keywords: ["status", "features", "roadmap", "progress"] },
];
