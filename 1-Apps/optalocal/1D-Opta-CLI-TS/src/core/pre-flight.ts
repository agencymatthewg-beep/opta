import chalk from 'chalk';
import { input, confirm, select } from '@inquirer/prompts';
import { createSpinner } from '../ui/spinner.js';
import type { OptaConfig } from './config.js';
import type OpenAI from 'openai';
import { getOrCreateClient } from './agent-setup.js';
import { ensureModel } from './errors.js';

export interface PreFlightResult {
  proceed: boolean;
  refinedObjective: string;
}

interface SuggestedApproach {
  name: string;
  value: string;
  description: string;
}

interface ObjectiveAnalysis {
  questions: string[];
  suggestedApproaches: SuggestedApproach[];
  estimatedSteps: number;
  dependencies: string[];
}

const DEFAULT_OBJECTIVE_ANALYSIS: ObjectiveAnalysis = {
  questions: ['Are there any specific service boundaries or free-tier constraints I should know about?'],
  suggestedApproaches: [
    {
      name: 'Standard Autonomous Execution',
      value: 'standard',
      description: 'Use default tools to solve the request',
    },
  ],
  estimatedSteps: 15,
  dependencies: [],
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function toApproachArray(value: unknown): SuggestedApproach[] {
  if (!Array.isArray(value)) return [];
  const approaches: SuggestedApproach[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate['name'] !== 'string' ||
      typeof candidate['value'] !== 'string' ||
      typeof candidate['description'] !== 'string'
    ) {
      continue;
    }
    approaches.push({
      name: candidate['name'],
      value: candidate['value'],
      description: candidate['description'],
    });
  }
  return approaches;
}

function parseObjectiveAnalysis(content: string): ObjectiveAnalysis {
  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_OBJECTIVE_ANALYSIS;
    }
    const record = parsed as Record<string, unknown>;
    const questions = toStringArray(record['questions']);
    const suggestedApproaches = toApproachArray(record['suggestedApproaches']);
    const dependencies = toStringArray(record['dependencies']);
    const estimatedStepsValue = record['estimatedSteps'];
    const estimatedSteps =
      typeof estimatedStepsValue === 'number' && Number.isFinite(estimatedStepsValue)
        ? Math.max(1, Math.round(estimatedStepsValue))
        : DEFAULT_OBJECTIVE_ANALYSIS.estimatedSteps;

    return {
      questions: questions.length > 0 ? questions : DEFAULT_OBJECTIVE_ANALYSIS.questions,
      suggestedApproaches:
        suggestedApproaches.length > 0
          ? suggestedApproaches
          : DEFAULT_OBJECTIVE_ANALYSIS.suggestedApproaches,
      estimatedSteps,
      dependencies,
    };
  } catch {
    return DEFAULT_OBJECTIVE_ANALYSIS;
  }
}

/**
 * Executes a transient LLM call to research the objective and return a structured JSON plan.
 */
async function analyzeObjective(
  client: OpenAI,
  model: string,
  objective: string
): Promise<ObjectiveAnalysis> {
  const prompt = `
You are Opta CEO Mode's Pre-Flight Architect.
The user wants to do the following task autonomously:
"${objective}"

Analyze this request and output a strictly valid JSON object (no markdown formatting, just the raw JSON) with the following structure:
{
  "questions": ["1-3 clarifying questions to ask the user, focusing on credentials, specific services (favor free/simple options), or tricky parameters"],
  "suggestedApproaches": [
    { "name": "Approach Name", "value": "internal_slug", "description": "Brief description of this approach" }
  ],
  "estimatedSteps": 10, // A rough integer estimate of how many tool actions this will take
  "dependencies": ["List of API keys, CLIs, or npm packages that will probably need to be installed/configured"]
}
`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a helpful JSON-only architect.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
  });

  const messageContent = response.choices[0]?.message.content;
  const content = typeof messageContent === 'string' ? messageContent : '{}';

  return parseObjectiveAnalysis(content);
}

export async function runPreFlightOrchestration(
  config: OptaConfig,
  objective: string
): Promise<PreFlightResult> {
  console.log(chalk.blue.bold('\n✈️  CEO Pre-Flight Checks Initiated\n'));
  const spinner = await createSpinner();

  spinner.start('Analyzing request for optimal approach & dependencies...');

  const client = await getOrCreateClient(config);
  const model = config.model.default;
  ensureModel(model);

  const analysis = await analyzeObjective(client, model, objective);
  spinner.stop();

  console.log(chalk.green('✓') + ' Analysis complete.\n');

  // --- Phase 1: Research & Approach Selection ---
  let refinedObjective = objective;

  if (analysis.questions.length > 0) {
    console.log(chalk.yellow.bold('Clarification Required:'));
    for (const q of analysis.questions) {
      const answer = await input({ message: chalk.dim('? ') + q });
      if (answer.trim()) {
        refinedObjective += `\n[Context: ${q} -> ${answer}]`;
      }
    }
    console.log('');
  }

  if (analysis.suggestedApproaches.length > 1) {
    const approach = await select({
      message: 'Select the primary approach for this autonomous run:',
      choices: analysis.suggestedApproaches
    });
    refinedObjective += `\n[Selected Approach: ${approach}]`;
    console.log('');
  }

  // --- Phase 2: Dependency & Credential Management ---
  if (analysis.dependencies.length > 0) {
    console.log(chalk.cyan.bold('Detected Dependencies / Prerequisites:'));
    for (const dep of analysis.dependencies) {
      console.log(`  • ${dep}`);
    }
    console.log(chalk.dim('\nCEO Mode will proactively attempt to handle/install these during execution where possible.'));

    const hasKeys = await confirm({ message: 'Do you have all required API keys/credentials ready in your environment?', default: true });
    if (!hasKeys) {
      console.log(chalk.yellow('Please export required keys into your terminal, or provide them when prompted by the CEO agent.\n'));
    } else {
      console.log('');
    }
  }

  // --- Phase 3: Final Outline & ETA ---
  const minsPerStep = 0.8; // Rough estimate of 45-60s per complex tool thought/execution
  const estMins = Math.max(2, Math.ceil(analysis.estimatedSteps * minsPerStep));

  console.log(chalk.magenta.bold('Autonomous Run Blueprint:'));
  console.log(`  • Estimated steps: ~${analysis.estimatedSteps}`);
  console.log(`  • Estimated TTL:   ~${estMins} minutes\n`);

  const proceed = await confirm({ message: chalk.bold('Ready for CEO Mode to take over?'), default: true });

  return {
    proceed,
    // Inject our distilled context into the final objective prompt
    refinedObjective: proceed ? refinedObjective : objective
  };
}
