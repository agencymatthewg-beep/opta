import type { Guide } from './index';

export const accountsMasterclass: Guide = {
  slug: 'accounts-masterclass',
  title: 'Accounts Masterclass',
  app: 'accounts',
  category: 'reference',
  template: 'holistic-whole-app',
  summary: 'A complete overview of the Opta Accounts infrastructure. Learn how local machines synchronize securely with cloud identities and centralize tool configurations.',
  tags: ['accounts', 'auth', 'sso', 'sync', 'security', 'masterclass'],
  updatedAt: '2026-03-04',
  sections: [
    {
      heading: 'Ecosystem Role',
      body: 'While Opta is fundamentally "local-first", development teams need portability. <a href="/guides/accounts" class="app-link link-accounts">Opta Accounts</a> (hosted at <code>accounts.optalocal.com</code>) acts as the secure, encrypted bridge between your cloud identity and your local <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> daemon. It handles Supabase SSO, license verification, and telemetry aggregation.',
      visual: `<div class="visual-wrapper my-8 relative flex items-center justify-between p-8 rounded-xl border border-[#3b82f6]/20 bg-[#020617] overflow-hidden shadow-2xl">
        <div class="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:30px_30px]"></div>
        
        <!-- Local -->
        <div class="relative z-10 w-32 bg-[#0f172a] border border-[#3b82f6]/40 p-3 rounded-lg flex flex-col gap-2 items-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
           <div class="text-[10px] font-mono text-[#3b82f6] uppercase font-bold tracking-wider">Local CLI</div>
           <div class="w-full text-[9px] font-mono text-text-muted bg-void p-1 rounded text-center truncate">~/.opta/accounts.json</div>
        </div>

        <!-- Sync Bridge -->
        <div class="flex-1 relative z-10 flex flex-col items-center mx-4">
           <div class="w-full flex justify-center mb-2">
             <svg class="w-6 h-6 text-[#3b82f6] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
           </div>
           <div class="w-full h-px bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent"></div>
           <div class="text-[8px] font-mono text-white/50 mt-1 uppercase tracking-widest">TLS 1.3 Handshake</div>
        </div>

        <!-- Cloud -->
        <div class="relative z-10 w-32 bg-[#0f172a] border border-white/20 p-3 rounded-lg flex flex-col gap-2 items-center shadow-lg">
           <div class="text-[10px] font-mono text-white uppercase font-bold tracking-wider">Opta Cloud</div>
           <div class="w-full flex gap-1 justify-center">
             <div class="w-2 h-2 rounded-full bg-[#22c55e]"></div>
             <div class="w-2 h-2 rounded-full bg-[#22c55e]"></div>
             <div class="w-2 h-2 rounded-full bg-[#22c55e]"></div>
           </div>
        </div>
      </div>`
    },
    {
      heading: 'Cloud Keychain & Token Rotation',
      body: 'Manually managing <code>.env</code> files across five different laptops is a security risk. Opta Accounts includes a Cloud Keychain. By running <code>opta login</code>, your CLI fetches an encrypted payload of your Anthropic, OpenAI, or Universal Provider keys and securely injects them directly into the daemon\'s memory. These keys are never written to plaintext files on disk.',
      code: `$ opta login\n\n> Opening browser to accounts.optalocal.com...\n> Authenticated as matthew@optamize.biz\n> Synced 3 provider keys to in-memory keychain.\n> Ready.`
    },
    {
      heading: 'Security Boundaries & Blast Radius Control',
      body: 'Accounts is intentionally split into trust zones so a failure in one layer does not automatically leak the rest of your stack. The identity plane mints short-lived Supabase sessions, the secret plane holds envelope-encrypted provider credentials, and the policy plane decides what each local daemon can request. A signed local session may decrypt keys for runtime use, but it still cannot export raw secret payloads or bypass org policy checks. High-risk operations such as profile schema edits, license overrides, and org-wide policy pushes require scoped service roles and produce immutable audit event IDs. This design keeps login and sync workflows fast for developers while limiting blast radius during suspicious activity.',
      code: `opta accounts policy inspect --effective\n\nSession Scope: [profile:read, keychain:decrypt]\nBlocked Cloud Ops: [key_export, license_override, telemetry_delete]\nAudit Stream: append-only (retention: 365d)`
    },
    {
      heading: 'Incident Recovery & Break-Glass Workflow',
      body: 'When a workstation is lost, malware is suspected, or token anomalies are detected, recovery should be deterministic rather than ad hoc. The recommended order is: open an incident, revoke all active refresh tokens, quarantine the affected device identity, rotate provider keys, and then re-authenticate from a clean machine. Accounts propagates revocation through websocket fan-out and heartbeat checks so stale sessions are cut quickly, while preserving read-only audit visibility for investigation. Because license manifests are signed, air-gapped commands remain available, but privileged account mutations are denied until trust is restored. Teams should run this playbook in a quarterly drill so responders can execute the sequence quickly under pressure and verify every control works as intended.',
      code: `opta accounts incident start --device "mbp-14-matt" --reason "token anomaly"\nopta accounts revoke --all-sessions --user matthew@optamize.biz\nopta accounts keychain rotate --providers openai,anthropic --invalidate-old\nopta login --force --device-trust-check`
    },
    {
      heading: 'Team Rollout Patterns For New Orgs',
      body: 'Large teams should not enable full autonomy on day one. A reliable rollout pattern starts with Ring 0 platform owners, then expands to a pilot group, and only then to all engineers once audit quality and recovery metrics are stable. During Ring 1, enforce strict defaults: read-heavy automation enabled, destructive write actions gated, and policy changes requiring two maintainers. During Ring 2, gradually relax controls per team based on measured incident rate and command approval latency. Accounts supports this by syncing profile bundles per org unit, mapping SSO groups to policy tiers, and providing drift alerts when local settings diverge from baseline. This staged model reduces onboarding friction while keeping governance consistent across devices and regions.',
      visual: `<div class="visual-wrapper my-8 bg-void border border-white/10 rounded-xl p-5">
        <div class="text-xs font-mono text-white mb-3 uppercase tracking-wider">Rollout Rings</div>
        <div class="grid grid-cols-3 gap-3 text-[11px] font-mono">
          <div class="rounded-lg border border-[#22c55e]/40 bg-[#052e16]/40 p-3">
            <div class="text-[#22c55e] font-bold mb-1">Ring 0</div>
            <div class="text-text-muted">Platform owners validate SSO mapping, keychain import, and baseline policy.</div>
          </div>
          <div class="rounded-lg border border-[#f59e0b]/40 bg-[#451a03]/40 p-3">
            <div class="text-[#f59e0b] font-bold mb-1">Ring 1</div>
            <div class="text-text-muted">Pilot teams run with guarded writes and two-maintainer policy approvals.</div>
          </div>
          <div class="rounded-lg border border-[#3b82f6]/40 bg-[#0c1f3f]/40 p-3">
            <div class="text-[#3b82f6] font-bold mb-1">Ring 2</div>
            <div class="text-text-muted">Org-wide rollout after drift, incident, and recovery SLOs remain healthy.</div>
          </div>
        </div>
      </div>`,
      code: `opta accounts rollout init --org "opta-core" --baseline "guarded-default"\nopta accounts rollout promote --from ring-0 --to ring-1 --require-approvals 2\nopta accounts rollout status --show-drift --show-sso-groups`
    },
    {
      heading: 'Autonomy Preset Syncing',
      body: 'Your "Do Mode" preferences (e.g., auto-approving terminal commands but requiring approval for file writes) are deeply personal. Opta Accounts serializes your <code>agent-profiles.json</code> and syncs it. If you switch from your Mac Studio to your MacBook Air, your agent behaves with the exact same level of trust and operational boundaries seamlessly.',
      visual: `<div class="visual-wrapper my-8 bg-void border border-white/10 rounded-xl p-5 font-mono text-xs text-text-muted">
        <div class="text-white mb-2">// Synced Profile Payload</div>
        <div class="pl-4 border-l border-[#3b82f6]/30">
          <div class="text-[#3b82f6]">"autonomyProfile": {</div>
          <div class="pl-4">"autoApproveReads": <span class="text-[#22c55e]">true</span>,</div>
          <div class="pl-4">"autoApproveWrites": <span class="text-[#ef4444]">false</span>,</div>
          <div class="pl-4">"maxAutonomousDurationMs": <span class="text-[#f59e0b]">3600000</span>,</div>
          <div class="pl-4">"blockedTools": ["delete_file", "git_push"]</div>
          <div class="text-[#3b82f6]">}</div>
        </div>
        <div class="mt-4 flex items-center gap-2 text-[10px]">
          <div class="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></div> State: Synchronized across 2 devices
        </div>
      </div>`
    },
    {
      heading: 'Local License Aggregation',
      body: 'Opta is distributed under a hybrid local license model. The Accounts daemon acts as the centralized verifier for all enterprise and pro-tier extensions (like the <a href="/guides/cli" class="app-link link-cli">CLI</a> Atpo supervisor). Instead of pinging the cloud on every command, Opta Accounts caches a cryptographically signed license manifest locally, allowing your apps to run in fully air-gapped environments while remaining compliant.',
      code: `opta accounts status\n\nLicense: Opta Pro (Active)\nAir-Gap Validity: 14 days remaining\nFeatures Unlocked: [LMX, Desktop, CEO Mode, Atpo]`
    }
  ],
};
