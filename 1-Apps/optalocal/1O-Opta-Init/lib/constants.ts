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
      "One control layer for install, launch, and maintenance across your Opta Local applications.",
  },
  {
    icon: "layout",
    title: "Launcher Workflows",
    description:
      "Start Opta Code, open the Opta Local platform, and route into account controls from one place.",
  },
  {
    icon: "layers",
    title: "Update Orchestration",
    description:
      "Coordinate version-safe updates for apps and runtime components without manual dependency juggling.",
  },
  {
    icon: "activity",
    title: "Daemon Operations",
    description:
      "Monitor daemon health, restart services, and recover runtime state when authentication or sessions drift.",
  },
  {
    icon: "cpu",
    title: "Apple Silicon Native",
    description:
      "Built for M1, M2, M3, and M4 environments where the Opta Local stack runs with local acceleration.",
  },
  {
    icon: "plug",
    title: "Platform Separation",
    description:
      "Opta Init manages and updates the stack; Opta Local platform delivers day-to-day app and model workflows.",
  },
] as const;

export const SHOWCASE_CONTENT = {
  welcome: {
    heading: "Manager Home",
    caption:
      "Open Opta Init and choose a workflow: launch apps, run updates, or control daemon services.",
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
