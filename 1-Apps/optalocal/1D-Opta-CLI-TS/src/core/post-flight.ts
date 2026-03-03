import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { confirm, input } from '@inquirer/prompts';
import { OptaConfig } from './config.js';
import { getOrCreateClient } from './agent-setup.js';
import { ensureModel } from './errors.js';
import { captureLearningEvent } from '../learning/hooks.js';
import type { AgentMessage } from './agent.js';
import { createSpinner } from '../ui/spinner.js';

/**
 * Analyzes the completed run messages to determine what went well, what struggled,
 * and what could be improved.
 */
async function analyzeRun(
    client: any,
    model: string,
    messages: AgentMessage[],
    objective: string
): Promise<{ summary: string; improvements: string[]; keyPhases: string[] }> {
    // We only care about the assistant and tool interactions
    const trace = messages
        .filter(m => m.role !== 'system')
        .map(m => {
            if (m.role === 'tool') return `[Tool Result]`;
            if (m.role === 'assistant' && m.tool_calls) {
                return `[Assistant Called Tools: ${m.tool_calls.map(tc => tc.function.name).join(', ')}]`;
            }
            return `[Assistant Output]`;
        })
        .join('\n');

    const prompt = `
You are the Opta CEO Post-Flight Analyst.
Review the following trace of an autonomous execution for the objective: "${objective}"

Trace:
${trace}

Provide a JSON object analyzing the run (NO markdown formatting, just raw JSON):
{
  "summary": "1 sentence describing how the run went overall.",
  "improvements": ["1-2 things the agent could have done faster or better"],
  "keyPhases": ["A short name for the main phase of the work done"]
}
`;

    const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || '{}';
    try {
        const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanContent);
    } catch {
        return { summary: "Run completed successfully.", improvements: ["Optimize tool usage sequence"], keyPhases: ["Execution"] };
    }
}

async function saveRunLog(objective: string, messages: AgentMessage[]): Promise<string> {
    const logDir = join(process.cwd(), '.opta', 'ceo-runs');
    await mkdir(logDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `run-${timestamp}.md`;
    const filepath = join(logDir, filename);

    const lines = [`# CEO Run Log: ${new Date().toISOString()}`, `**Objective:** ${objective}`, ''];

    for (const m of messages) {
        if (m.role === 'system') continue;
        lines.push(`## ${m.role}`);
        if (typeof m.content === 'string' && m.content.trim()) {
            lines.push(m.content);
        }
        if (m.tool_calls && m.tool_calls.length > 0) {
            lines.push('**Tools Used:**');
            for (const tc of m.tool_calls) {
                lines.push(`- \`${tc.function.name}\``);
            }
        }
        lines.push('');
    }

    await writeFile(filepath, lines.join('\n'), 'utf-8');
    return filepath;
}

export async function runPostFlightReview(
    config: OptaConfig,
    messages: AgentMessage[],
    objective: string
): Promise<void> {
    console.log(chalk.blue.bold('\n🛬 CEO Post-Flight Review\n'));

    // 1. Generate local run log
    const logPath = await saveRunLog(objective, messages);
    console.log(chalk.dim(`  Saved Run Log to: ${logPath}\n`));

    const spinner = await createSpinner();
    spinner.start('Analyzing execution efficiency...');

    const client = await getOrCreateClient(config);
    const model = config.model.default;
    ensureModel(model);

    // 2. Self analysis
    const analysis = await analyzeRun(client, model, messages, objective);
    spinner.stop();

    console.log(chalk.cyan.bold('CEO Self-Analysis:'));
    console.log(`  • ${analysis.summary}`);
    for (const imp of analysis.improvements) {
        console.log(`  • ${chalk.yellow('Iterate:')} ${imp}`);
    }
    console.log('');

    // 3. Interactive prompt
    const review = await confirm({ message: 'Would you like to provide feedback to improve future CEO behavior?', default: true });
    if (!review) return;

    const feedback = await input({ message: chalk.dim('? ') + 'What did the CEO do well, or what should it do differently next time? ' });

    if (feedback.trim()) {
        // 4. Push to Learning Ledger
        spinner.start('Ingesting feedback to Learning Ledger...');
        await captureLearningEvent(config, {
            kind: 'reflection',
            topic: `Feedback on CEO Run: ${objective.substring(0, 40)}...`,
            content: `User feedback: ${feedback}\n\nAI Identified Improvements: ${analysis.improvements.join(', ')}`,
            tags: ['ceo', 'feedback'],
            verified: true
        });
        spinner.stop();
        console.log(chalk.green('✓') + ' Feedback ingested. The CEO will adapt in future runs.');
    }

    console.log(chalk.blue.bold('\nMission Complete.'));
}
