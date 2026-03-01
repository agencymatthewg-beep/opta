export type ReleaseNoteStatus = 'released' | 'rolling_out'

export interface ReleaseNote {
  id: string
  date: string
  title: string
  summary: string
  status: ReleaseNoteStatus
  highlights: string[]
  links?: Array<{
    label: string
    href: string
  }>
}

/**
 * Fallback notes used if generated notes are unavailable.
 * Keep newest notes first.
 */
export const FALLBACK_RELEASE_NOTES: ReleaseNote[] = [
  {
    id: '2026-03-01-runtime-health-signals',
    date: '2026-03-01',
    title: 'Smarter Runtime Health Signals',
    summary:
      'Rolling out richer runtime state indicators to make degradations obvious at a glance.',
    status: 'rolling_out',
    highlights: [
      'New nominal/busy/degraded/pressure/offline runtime labels',
      'Connection badge now reflects quality and recovery activity',
      'Status strip now surfaces latency and VRAM pressure severity',
    ],
    links: [{ label: 'Feature Registry', href: '/features?app=local-web' }],
  },
  {
    id: '2026-02-28-lmx-admin-coverage',
    date: '2026-02-28',
    title: 'Expanded LMX Admin Coverage',
    summary:
      'The web dashboard now exposes a much broader set of LMX admin capabilities.',
    status: 'released',
    highlights: [
      'Diagnostics, metrics, presets, stack, benchmark, quantize, helpers, and logs',
      'Improved model lifecycle flows and richer model management UI',
      'Dedicated workflows for operations and skills',
    ],
    links: [{ label: 'Local Web Features', href: '/features?app=local-web' }],
  },
  {
    id: '2026-02-28-dashboard-discovery',
    date: '2026-02-28',
    title: 'Dashboard Navigation & Discovery Refresh',
    summary:
      'Feature discovery was improved so core workflows are faster to find.',
    status: 'released',
    highlights: [
      'Quick Access grid added to the dashboard',
      'Enhanced More menu and improved keyboard/accessibility behavior',
      'Styling migrated to shared tokens for consistent rendering',
    ],
  },
  {
    id: '2026-02-26-production-readiness',
    date: '2026-02-26',
    title: 'Production Readiness Foundation',
    summary:
      'Remote-first architecture and readiness work to make the web client a primary control surface.',
    status: 'released',
    highlights: [
      'WAN-ready deployment model for status, init, and local-web surfaces',
      'Connection and auth flow hardening for daily use',
      'Reduced dependency on terminal-only workflows',
    ],
  },
]
