export const DOWNLOADS = {
  cli: {
    name: 'Opta CLI',
    description: 'Chat with AI models privately on your Mac — visual menus, no commands needed.',
    macos: 'https://github.com/optaops/opta-cli/releases/latest/download/opta-cli-macos.pkg',
    windows: null, // Coming in a future release
  },
  lmx: {
    name: 'Opta LMX',
    description: 'The engine that runs AI models on your Mac\u2019s hardware — installs in one click.',
    macos: 'https://github.com/optaops/opta-lmx/releases/latest/download/opta-lmx-macos.pkg',
    windows: null, // Coming in a future release
  },
} as const

export const DASHBOARD_URL = 'https://lmx.optalocal.com'

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Download', href: '#downloads' },
  { label: 'Dashboard', href: '#dashboard' },
] as const

export const FEATURES = [
  {
    icon: 'shield',
    title: 'Private & Local',
    description: 'Your conversations never leave your Mac. No cloud, no tracking, no data collection.',
  },
  {
    icon: 'layout',
    title: 'Visual Menus',
    description: 'Navigate with keyboard menus and overlays — no commands to memorize.',
  },
  {
    icon: 'layers',
    title: 'Multiple Models',
    description: 'Switch between AI models instantly. Load new ones with a single menu selection.',
  },
  {
    icon: 'activity',
    title: 'Real-time Dashboard',
    description: 'Monitor memory usage, model performance, and system health at a glance.',
  },
  {
    icon: 'cpu',
    title: 'Apple Silicon Optimized',
    description: 'Built for M1, M2, M3, and M4 chips — fast inference using your Mac\u2019s GPU.',
  },
  {
    icon: 'plug',
    title: 'OpenAI Compatible',
    description: 'Works with any app that supports the OpenAI API — connect your favorite tools.',
  },
] as const

export const SHOWCASE_CONTENT = {
  welcome: {
    heading: 'Welcome Screen',
    caption: 'Open Opta and you\u2019re greeted with a clean menu — pick an action and go.',
    logo: [
      '  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 ',
      ' \u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u255a\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557',
      ' \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d   \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551',
      ' \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u255d    \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551',
      ' \u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551       \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551',
      '  \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d       \u255a\u2550\u255d   \u255a\u2550\u255d  \u255a\u2550\u255d',
    ],
    menuItems: [
      { label: 'New Chat', shortcut: 'Enter' },
      { label: 'Resume Session', shortcut: 'r' },
      { label: 'Browse Models', shortcut: 'm' },
      { label: 'Settings', shortcut: 's' },
    ],
  },
  chat: {
    heading: 'Chat Interface',
    caption: 'Talk to your local AI with a clean, responsive chat — streaming replies in real time.',
    model: 'Qwen 2.5 7B',
    messages: [
      { role: 'user' as const, text: 'Summarize the key points of my meeting notes from today' },
      { role: 'assistant' as const, text: 'Here are the 3 key takeaways from your meeting:\n\n1. Launch timeline moved to March 15\n2. Budget approved for the new feature set\n3. Team expanding with two new hires' },
    ],
  },
  menu: {
    heading: 'Command Palette',
    caption: 'Press Shift+Space to open the menu — browse models, switch settings, all by keyboard.',
    items: [
      { label: 'Switch Model', active: false },
      { label: 'Qwen 2.5 7B', active: true },
      { label: 'Llama 3.1 8B', active: false },
      { label: 'DeepSeek R1 14B', active: false },
      { label: 'Mistral Small 22B', active: false },
    ],
    hint: '\u2191\u2193 Navigate  Enter Select  Esc Close',
  },
} as const
