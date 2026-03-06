#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const guidesDir = path.join(projectRoot, 'content', 'guides');
const indexPath = path.join(guidesDir, 'index.ts');

const ALLOWED_APPS = new Set(['lmx', 'cli', 'accounts', 'init', 'general']);
const ALLOWED_CATEGORIES = new Set([
  'getting-started',
  'feature',
  'troubleshooting',
  'reference',
]);
const ALLOWED_TEMPLATES = new Set([
  'holistic-whole-app',
  'feature-deep-dive',
  'process-workflow',
  'setting-configuration',
  'visual-interactive-journey',
]);

function usage() {
  console.log(`\nUsage:\n  npm run guide:new -- --slug <slug> --title <title> --app <app> --category <category> --template <template> [--summary <summary>] [--updatedAt YYYY-MM-DD] [--status draft|verified]\n\nAllowed values:\n  app: lmx | cli | accounts | init | general\n  category: getting-started | feature | troubleshooting | reference\n  template: holistic-whole-app | feature-deep-dive | process-workflow | setting-configuration | visual-interactive-journey\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function fail(message) {
  console.error(`\nError: ${message}`);
  usage();
  process.exit(1);
}

function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function toExportName(slug) {
  const camel = slug
    .split('-')
    .map((part, idx) => (idx === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join('');
  return `${camel}Guide`;
}

function sectionTemplate(template) {
  switch (template) {
    case 'holistic-whole-app':
      return [
        {
          heading: '[Setup] Ecosystem Role / Overview',
          body:
            'This section should explain where this application sits inside the Opta Local ecosystem, what primary user problem it solves, and how it interacts with adjacent apps. Keep the tone practical and specific, and include cross-app links such as /guides/lmx, /guides/cli, and /guides/accounts when relevant to real workflows.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="grid grid-cols-3 gap-3 text-xs font-mono"><div class="rounded-lg bg-white/[0.03] p-3">Entrypoint</div><div class="rounded-lg bg-white/[0.03] p-3">Core Runtime</div><div class="rounded-lg bg-white/[0.03] p-3">Outputs</div></div></div>',
        },
        {
          heading: '[Configuration] Core Configuration Surfaces',
          body:
            'Document the concrete settings surfaces that control this app: CLI flags, profile keys, environment variables, and UI toggles. Include defaults, recommended safe values, and where each setting is applied at runtime.',
          code:
            'opta config view\nopta config set profile.default standard\nopta status',
        },
        {
          heading: '[Operation] Runtime Workflow',
          body:
            'Describe the day-to-day execution path from first command to steady-state usage. Include observable checkpoints (logs, status output, state transitions) so an operator can verify each phase without guesswork.',
          code:
            'opta do "run baseline workflow and capture verification output"',
        },
        {
          heading: '[Troubleshooting] Failure Modes and Recovery',
          body:
            'Identify common failure signatures, likely root causes, and deterministic recovery steps. Include escalation boundaries and quick triage ordering so users can recover without restarting the full workflow.',
        },
        {
          heading: '[Optimization] Performance and Reliability Tuning',
          body:
            'Explain practical tuning loops for throughput, latency, stability, and operator ergonomics. Include concrete optimization levers and how to validate whether tuning improved outcomes.',
        },
        {
          heading: 'Architecture Deep Dive',
          body:
            'Describe the system design, key components, data flow, and local runtime boundaries. Explain why these architectural choices support reliability, performance, or privacy in an Opta Local context. Include concrete implementation notes so an advanced user can reason about behavior and not just surface-level features.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="grid gap-3 text-xs font-mono"><div class="rounded-lg bg-white/[0.03] p-3">Client Surfaces</div><div class="rounded-lg bg-white/[0.03] p-3">Daemon + Policy Layer</div><div class="rounded-lg bg-white/[0.03] p-3">Inference + Storage Boundaries</div></div></div>',
        },
        {
          heading: 'Integrated Deployment and Team Workflow',
          body:
            'Show end-to-end flows combining this app with other Opta tools. Include deployment-ready handoffs, verification points, and rollback considerations so teams can run the system predictably from first setup through ongoing operation.',
          code:
            'npm run check\nnpm run build\n# deploy only after verification gates pass',
        },
      ];
    case 'feature-deep-dive':
      return [
        {
          heading: '[Setup] Feature Scope and Prerequisites',
          body:
            'Define the capability clearly, including what it does and what it intentionally does not do. Anchor the explanation in user outcomes so readers can quickly determine if the feature matches their scenario, then add short technical context to orient advanced users to core behavior and limits.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="flex items-center justify-between text-xs font-mono"><span>Intent</span><span>→</span><span>Execution</span><span>→</span><span>Verification</span></div></div>',
        },
        {
          heading: '[Configuration] Settings and Defaults',
          body:
            'List concrete settings, defaults, and configuration boundaries required to enable this feature safely. Include where each option is configured and which combinations should be avoided.',
        },
        {
          heading: '[Operation] Runtime Execution',
          body:
            'Describe how the feature behaves during normal runtime, including request flow, expected outputs, and verification signals. Keep this execution-focused and observable.',
          code:
            'opta status\nopta do "execute feature path and report verification signals"',
        },
        {
          heading: '[Troubleshooting] Failure Signatures and Fixes',
          body:
            'Capture common failure cases, probable root causes, and fastest corrective actions. Include operator decision rules for when to retry, reconfigure, or rollback.',
          note:
            'Include at least one failure signature and one deterministic recovery path before marking the guide as verified.',
        },
        {
          heading: '[Optimization] Tuning and Scaling Guidance',
          body:
            'Provide performance/reliability optimization guidance and explain which metrics or signals confirm that changes improved behavior.',
        },
      ];
    case 'process-workflow':
      return [
        {
          heading: '[Setup] Prerequisites',
          body:
            'Document required context, local setup, expected permissions, and dependency versions before execution begins. State what should already exist in the user environment, and include pre-flight checks that prevent avoidable setup failures when the workflow is executed from a clean local state.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><ol class="space-y-2 text-xs font-mono"><li>1. Verify runtime dependencies</li><li>2. Confirm configuration profile</li><li>3. Run preflight command</li></ol></div>',
        },
        {
          heading: '[Configuration] Workflow Parameters',
          body:
            'Define the key configuration inputs and defaults for this workflow. Explain which parameters are required versus optional and how they affect downstream behavior.',
        },
        {
          heading: '[Operation] Step-by-Step Execution',
          body:
            'Write sequential steps with clear intent and expected outputs. Keep each step operational and observable, and make transition points explicit. This section should enable deterministic execution by a new teammate without external clarification while preserving the standard Opta Learn rhythm and formatting.',
          code: 'npm run dev\n# add workflow command(s) here\n# verify command output after each step',
        },
        {
          heading: '[Troubleshooting] Verification and Failure Recovery',
          body:
            'Describe exact checks that confirm success, including terminal output, rendered routes, or observable state transitions. Include remediation hints for the most common failure signatures so users can debug quickly and continue execution without restarting the entire process from the beginning.',
          note:
            'If verification fails, roll back one step at a time and re-run the same check before proceeding.',
        },
        {
          heading: '[Optimization] Repeatability and Performance',
          body:
            'Add refinements that reduce runtime variance and improve throughput once the baseline workflow is working. Include concrete repeatability checks for team handoff scenarios.',
        },
      ];
    case 'setting-configuration':
      return [
        {
          heading: '[Setup] Context and Intent',
          body:
            'State when this setting should be introduced in a workflow and what system context must already exist before it is changed.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="grid grid-cols-3 gap-2 text-xs font-mono"><div class="rounded-lg bg-white/[0.03] p-3">Default</div><div class="rounded-lg bg-white/[0.03] p-3">Proposed</div><div class="rounded-lg bg-white/[0.03] p-3">Rollback</div></div></div>',
        },
        {
          heading: '[Configuration] Definition and Defaults',
          body:
            'State what this setting controls, the default behavior, and where the value is applied at runtime. Keep terminology precise and implementation-aware so users understand both the immediate effect and any deferred effect that appears only after a restart or deployment refresh.',
        },
        {
          heading: '[Operation] Runtime Impact',
          body:
            'Explain performance, security, UX, and reliability implications of this setting. Include tradeoffs and known edge behavior so users can make intentional choices. This section should help teams choose a value based on operational constraints rather than adopting defaults without context.',
        },
        {
          heading: '[Troubleshooting] Misconfiguration Patterns',
          body:
            'Show valid and invalid value patterns with explanations. Make examples representative of real Opta Local workflows and include at least one recommendation for development defaults versus production-leaning local operation. Keep examples minimal but unambiguous for copy-and-adapt usage.',
          code: 'SETTING_NAME=true\nSETTING_NAME=false\n# invalid: SETTING_NAME=maybe',
        },
        {
          heading: '[Optimization] Guardrails and Safe Tuning',
          body:
            'Highlight failure modes, destructive side effects, and rollback advice. Include specific signals that indicate the setting was applied incorrectly and the fastest path to recovery. This section should reduce operational risk by making dangerous states explicit and easy to identify.',
          note: 'Replace with high-impact warnings specific to this setting before marking the guide as verified.',
        },
      ];
    case 'visual-interactive-journey':
      return [
        {
          heading: '[Setup] Intent Map',
          body:
            'Anchor the user in one sentence, then immediately show the visual journey map for this guide.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="grid grid-cols-5 gap-2 text-[11px] font-mono"><div class="rounded-lg bg-white/[0.03] p-2">Setup</div><div class="rounded-lg bg-white/[0.03] p-2">Config</div><div class="rounded-lg bg-white/[0.03] p-2">Operate</div><div class="rounded-lg bg-white/[0.03] p-2">Recover</div><div class="rounded-lg bg-white/[0.03] p-2">Optimize</div></div></div>',
        },
        {
          heading: '[Configuration] Control Surfaces',
          body:
            'Show where users configure this capability and what defaults are safe.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="grid grid-cols-3 gap-3 text-xs font-mono"><div class="rounded-lg bg-white/[0.03] p-3">UI Settings</div><div class="rounded-lg bg-white/[0.03] p-3">CLI Flags</div><div class="rounded-lg bg-white/[0.03] p-3">Env Vars</div></div></div>',
        },
        {
          heading: '[Operation] Interactive Run Path',
          body:
            'Represent normal execution flow with checkpoints users can verify in sequence.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><details open><summary class="font-mono text-xs">Run sequence</summary><ol class="mt-3 space-y-2 text-xs font-mono"><li>1. Trigger workflow</li><li>2. Observe runtime signal</li><li>3. Confirm expected output</li></ol></details></div>',
        },
        {
          heading: '[Troubleshooting] Failure Decision Tree',
          body:
            'Use a visual decision tree for diagnosis before falling back to text.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="text-xs font-mono space-y-2"><div class="rounded-lg bg-white/[0.03] p-2">Failure detected</div><div class="pl-4">├─ Config mismatch → reset profile</div><div class="pl-4">└─ Runtime stall → restart daemon path</div></div></div>',
          note:
            'Keep textual troubleshooting concise and map users back to concrete visual checks.',
        },
        {
          heading: '[Optimization] Performance Loop',
          body:
            'Close with a visual optimize-measure-adjust loop and one practical target.',
          visual:
            '<div class="visual-wrapper my-6 p-6 rounded-2xl bg-[#08080f]/80"><div class="grid grid-cols-3 gap-2 text-xs font-mono"><div class="rounded-lg bg-white/[0.03] p-2">Measure</div><div class="rounded-lg bg-white/[0.03] p-2">Tune</div><div class="rounded-lg bg-white/[0.03] p-2">Verify</div></div></div>',
        },
      ];
    default:
      return [];
  }
}

function renderGuideSource({ exportName, slug, title, app, category, template, summary, updatedAt }) {
  const sections = sectionTemplate(template);
  const renderedSections = sections
    .map((section) => {
      const fields = [
        `heading: ${JSON.stringify(section.heading)}`,
        `body: ${JSON.stringify(section.body)}`,
      ];
      if (section.note) fields.push(`note: ${JSON.stringify(section.note)}`);
      if (section.code) fields.push(`code: ${JSON.stringify(section.code)}`);
      if (section.visual) fields.push(`visual: ${JSON.stringify(section.visual)}`);
      return `    {\n      ${fields.join(',\n      ')}\n    }`;
    })
    .join(',\n');

  return `import type { Guide } from './index';\n\nexport const ${exportName}: Guide = {\n  slug: '${slug}',\n  title: ${JSON.stringify(title)},\n  app: '${app}',\n  category: '${category}',\n  template: '${template}',\n  summary: ${JSON.stringify(summary)},\n  tags: [${JSON.stringify(app)}, ${JSON.stringify(category)}, ${JSON.stringify(template)}],\n  updatedAt: '${updatedAt}',\n  sections: [\n${renderedSections}\n  ]\n};\n`;
}

function registerInIndex(indexSource, fileBase, exportName, status) {
  const importLine = `import { ${exportName} } from './${fileBase}';`;
  if (!indexSource.includes(importLine)) {
    const allGuidesDecl = indexSource.match(
      /export const allGuides:\s*[A-Za-z_$][\w$]*\[]\s*=\s*\[/,
    );
    if (!allGuidesDecl || allGuidesDecl.index === undefined) {
      throw new Error('Could not locate allGuides array in content/guides/index.ts');
    }
    const allGuidesIndex = allGuidesDecl.index;

    const beforeAllGuides = indexSource.slice(0, allGuidesIndex);
    const afterAllGuides = indexSource.slice(allGuidesIndex);
    indexSource = `${beforeAllGuides}${importLine}\n${afterAllGuides}`;
  }

  const insertionLine = `  { ...${exportName}, status: '${status}' },`;
  if (!indexSource.includes(insertionLine)) {
    const arrayMatch = indexSource.match(
      /export const allGuides:\s*[A-Za-z_$][\w$]*\[]\s*=\s*\[[\s\S]*?\n\];/,
    );
    if (!arrayMatch) {
      throw new Error('Could not parse allGuides array for registration');
    }

    const block = arrayMatch[0];
    const updatedBlock = block.replace(/\n\];$/, `\n${insertionLine}\n];`);
    indexSource = indexSource.replace(block, updatedBlock);
  }

  return indexSource;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  usage();
  process.exit(0);
}

const slug = args.slug;
const title = args.title;
const app = args.app;
const category = args.category;
const template = args.template;
const summary = args.summary || `Guide for ${title ?? slug}.`;
const updatedAt = args.updatedAt || new Date().toISOString().slice(0, 10);
const status = args.status || 'draft';

if (!slug) fail('Missing --slug');
if (!isValidSlug(slug)) fail(`Invalid slug '${slug}'. Use kebab-case only.`);
if (!title) fail('Missing --title');
if (!app || !ALLOWED_APPS.has(app)) fail(`Invalid --app '${String(app)}'`);
if (!category || !ALLOWED_CATEGORIES.has(category)) fail(`Invalid --category '${String(category)}'`);
if (!template || !ALLOWED_TEMPLATES.has(template)) fail(`Invalid --template '${String(template)}'`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(updatedAt)) fail(`Invalid --updatedAt '${updatedAt}'. Expected YYYY-MM-DD.`);
if (!['draft', 'verified'].includes(status)) fail(`Invalid --status '${status}'. Use draft or verified.`);

if (!fs.existsSync(guidesDir)) {
  fail(`Guides directory does not exist: ${guidesDir}`);
}

const filePath = path.join(guidesDir, `${slug}.ts`);
if (fs.existsSync(filePath)) {
  fail(`Guide file already exists: ${filePath}`);
}

if (!fs.existsSync(indexPath)) {
  fail(`Guide index not found: ${indexPath}`);
}

const exportName = toExportName(slug);
const source = renderGuideSource({
  exportName,
  slug,
  title,
  app,
  category,
  template,
  summary,
  updatedAt,
});

fs.writeFileSync(filePath, source, 'utf8');

let indexSource = fs.readFileSync(indexPath, 'utf8');
if (indexSource.includes(`slug: '${slug}'`)) {
  fail(`Slug '${slug}' already exists in index.ts`);
}
indexSource = registerInIndex(indexSource, slug, exportName, status);
fs.writeFileSync(indexPath, indexSource, 'utf8');

console.log(`Created guide: content/guides/${slug}.ts`);
console.log(`Registered import and allGuides entry as status='${status}'.`);
console.log('Next steps: npm run guides:validate && npm run lint');
