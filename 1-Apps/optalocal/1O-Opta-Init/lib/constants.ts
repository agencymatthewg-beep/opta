export const DASHBOARD_URL = "https://lmx.optalocal.com";
export const ACCOUNTS_URL = "https://accounts.optalocal.com";
export const PLATFORM_URL = "https://optalocal.com";

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Download", href: "#downloads" },
  { label: "Dashboard", href: "#dashboard" },
] as const;

export const FEATURES = [
  {
    icon: "shield",
    title: "Central App Manager",
    description:
      "The single native initializer surface needed to install, launch, and manage Opta Code, Opta CLI, and Opta LMX.",
  },
  {
    icon: "layout",
    title: "Daemon Supervisor Drawer",
    description:
      "A sleek sliding glass drawer to monitor, kill, or restart background inference processes completely out-of-band from your code editor.",
  },
  {
    icon: "layers",
    title: "Manifest-Driven Updates",
    description:
      "Say goodbye to broken dependencies. Roll out safe, cryptographically signed updates across the entire stack simultaneously.",
  },
  {
    icon: "activity",
    title: "Stable & Beta Channels",
    description:
      "Safely opt-in to bleeding-edge developer features or stay on the proven stable track, managed from one trusted control plane.",
  },
  {
    icon: "cpu",
    title: "Apple Silicon Native",
    description:
      "Built as a blazingly fast Rust/Tauri desktop application specifically optimized for M1, M2, M3, and M4 hardware.",
  },
  {
    icon: "plug",
    title: "Zero-Server Static Edge",
    description:
      "The initial distribution site is served globally via edge CDNs with zero backend logic, guaranteeing instant and secure availability.",
  },
] as const;

export const SHOWCASE_CONTENT = {
  welcome: {
    heading: "Manager Home",
    caption:
      "Open Opta Init (the Opta Initializer, short for `opta init`) and choose a workflow: launch apps, run updates, or control daemon services.",
    logo: ["  OPTA CODE"],
    menuItems: [
      { label: "Launch Opta Code", shortcut: "Enter" },
      { label: "Manage Updates", shortcut: "u" },
      { label: "Daemon Controls", shortcut: "d" },
      { label: "Open Opta Local", shortcut: "o" },
    ],
  },
  chat: {
    heading: "Ops Console",
    caption:
      "Track update state and maintenance output in real time while the manager coordinates stack changes.",
    model: "Init Ops Agent",
    messages: [
      {
        role: "user" as const,
        text: "Apply pending app updates, then restart daemon and verify health.",
      },
      {
        role: "assistant" as const,
        text: "Update workflow started.\n\n1. Updated Opta Code Desktop to latest stable\n2. Restarted daemon at configured endpoint (auto-discovered)\n3. Health check passed and sessions reattached",
      },
    ],
  },
  menu: {
    heading: "Quick Actions",
    caption:
      "Use Shift+Space to manage apps, schedule updates, and operate daemon controls from one command surface.",
    items: [
      { label: "Launch App", active: false },
      { label: "Update Installed Apps", active: true },
      { label: "Daemon Status", active: false },
      { label: "Restart Daemon", active: false },
      { label: "Open Opta Local Platform", active: false },
    ],
    hint: "↑↓ Navigate  Enter Select  Esc Close",
  },
} as const;
