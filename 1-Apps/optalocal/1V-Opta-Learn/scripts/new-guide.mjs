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
]);

function usage() {
  console.log(`\nUsage:\n  npm run guide:new -- --slug <slug> --title <title> --app <app> --category <category> --template <template> [--summary <summary>] [--updatedAt YYYY-MM-DD] [--status draft|verified]\n\nAllowed values:\n  app: lmx | cli | accounts | init | general\n  category: getting-started | feature | troubleshooting | reference\n  template: holistic-whole-app | feature-deep-dive | process-workflow | setting-configuration\n`);
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
          heading: 'Ecosystem Role / Overview',
          body:
            'This section should explain where this application sits inside the Opta Local ecosystem, what primary user problem it solves, and how it interacts with adjacent apps. Keep the tone practical and specific, and include cross-app links such as /guides/lmx, /guides/cli, and /guides/accounts when relevant to real workflows.',
        },
        {
          heading: 'Architecture',
          body:
            'Describe the system design, key components, data flow, and local runtime boundaries. Explain why these architectural choices support reliability, performance, or privacy in an Opta Local context. Include concrete implementation notes so an advanced user can reason about behavior and not just surface-level features.',
        },
        {
          heading: 'Feature Deep-Dive',
          body:
            'Break down major capabilities with clear user intent, expected outputs, and failure modes. This section should provide enough implementation-level detail for power users to understand constraints, tune behavior, and troubleshoot effectively while preserving the visual and instructional style used across Learn guides.',
        },
        {
          heading: 'Integrated Workflows',
          body:
            'Show end-to-end flows combining this app with other Opta tools. Use a sequence format that starts with prerequisites, then execution, then verification. Include at least one realistic handoff across apps and highlight the practical checks that confirm each phase worked as expected in local development.',
        },
      ];
    case 'feature-deep-dive':
      return [
        {
          heading: 'What This Feature Is',
          body:
            'Define the capability clearly, including what it does and what it intentionally does not do. Anchor the explanation in user outcomes so readers can quickly determine if the feature matches their scenario, then add short technical context to orient advanced users to core behavior and limits.',
        },
        {
          heading: 'Use Cases',
          body:
            'List practical situations where this feature is the right choice and where another approach is better. Focus on realistic workflows in Opta Local. Include the decision signals a user should evaluate before enabling the feature so usage is intentional rather than exploratory trial and error.',
        },
        {
          heading: 'Under the Hood',
          body:
            'Explain important implementation mechanics, lifecycle considerations, and dependencies that affect runtime outcomes. Keep this concise but concrete. Readers should finish this section understanding how configuration, state, and app boundaries influence behavior in normal and edge-case execution paths.',
        },
        {
          heading: 'Usage and Configuration',
          body:
            'Provide the recommended setup path, common options, and verification steps. Include enough detail for repeatable execution in both first-run and iterative development contexts. Make troubleshooting cues explicit so users can quickly recognize misconfiguration and correct course without workflow interruption.',
        },
      ];
    case 'process-workflow':
      return [
        {
          heading: 'Prerequisites',
          body:
            'Document required context, local setup, expected permissions, and dependency versions before execution begins. State what should already exist in the user environment, and include pre-flight checks that prevent avoidable setup failures when the workflow is executed from a clean local state.',
        },
        {
          heading: 'Step-by-Step Execution',
          body:
            'Write sequential steps with clear intent and expected outputs. Keep each step operational and observable, and make transition points explicit. This section should enable deterministic execution by a new teammate without external clarification while preserving the standard Opta Learn rhythm and formatting.',
          code: 'npm run dev\n# add workflow command(s) here\n# verify command output after each step',
        },
        {
          heading: 'Verification',
          body:
            'Describe exact checks that confirm success, including terminal output, rendered routes, or observable state transitions. Include remediation hints for the most common failure signatures so users can debug quickly and continue execution without restarting the entire process from the beginning.',
        },
      ];
    case 'setting-configuration':
      return [
        {
          heading: 'Definition',
          body:
            'State what this setting controls, the default behavior, and where the value is applied at runtime. Keep terminology precise and implementation-aware so users understand both the immediate effect and any deferred effect that appears only after a restart or deployment refresh.',
        },
        {
          heading: 'Impact',
          body:
            'Explain performance, security, UX, and reliability implications of this setting. Include tradeoffs and known edge behavior so users can make intentional choices. This section should help teams choose a value based on operational constraints rather than adopting defaults without context.',
        },
        {
          heading: 'Examples',
          body:
            'Show valid and invalid value patterns with explanations. Make examples representative of real Opta Local workflows and include at least one recommendation for development defaults versus production-leaning local operation. Keep examples minimal but unambiguous for copy-and-adapt usage.',
          code: 'SETTING_NAME=true\nSETTING_NAME=false\n# invalid: SETTING_NAME=maybe',
        },
        {
          heading: 'Warnings',
          body:
            'Highlight failure modes, destructive side effects, and rollback advice. Include specific signals that indicate the setting was applied incorrectly and the fastest path to recovery. This section should reduce operational risk by making dangerous states explicit and easy to identify.',
          note: 'Replace with high-impact warnings specific to this setting before marking the guide as verified.',
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
