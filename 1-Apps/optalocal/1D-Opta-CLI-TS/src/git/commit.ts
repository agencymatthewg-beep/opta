/**
 * Auto-commit module for Opta CLI.
 *
 * Generates commit messages via the LLM and commits session changes.
 * Uses `execa` with array arguments (no shell interpolation)
 * and `reject: false` for safe error handling.
 */

import { execa } from 'execa';
import { debug } from '../core/debug.js';
import type { AgentMessage } from '../core/agent.js';

/**
 * Extracts user + assistant messages into a text summary
 * suitable for commit message generation.
 *
 * Filters to only user and assistant roles (with content),
 * truncates each message to 200 characters.
 */
export function getSessionSummary(messages: AgentMessage[]): string {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content != null)
    .map((m) => {
      const raw = m.content!;
      const content = Array.isArray(raw)
        ? raw.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('')
        : raw;
      const truncated = content.length > 200 ? content.slice(0, 200) + '...' : content;
      return `[${m.role}] ${truncated}`;
    })
    .join('\n');
}

/**
 * Sends a session summary to the LLM to generate a conventional commit message.
 * Falls back to a default message on error.
 */
export async function generateCommitMessage(
  messages: AgentMessage[],
  client: import('openai').default,
  model: string
): Promise<string> {
  const summary = getSessionSummary(messages);
  const fallback = 'feat: apply AI-assisted changes';

  if (!summary.trim()) return fallback;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Generate a concise git commit message (max 72 chars for subject line) for these changes. Use conventional commit format (feat/fix/refactor/docs). Reply with ONLY the commit message, no explanation.',
        },
        { role: 'user', content: summary },
      ],
      max_tokens: 100,
    });

    const message = response.choices[0]?.message?.content?.trim();
    if (!message) return fallback;

    return message;
  } catch (err) {
    debug(`Failed to generate commit message: ${String(err)}`);
    return fallback;
  }
}

/**
 * Stages specified files via `git add`, verifies staged changes exist,
 * then commits with the given message.
 *
 * Returns true on success, false if nothing was staged or commit fails.
 */
export async function commitSessionChanges(
  cwd: string,
  files: string[],
  message: string
): Promise<boolean> {
  if (files.length === 0) {
    debug('commitSessionChanges: no files provided');
    return false;
  }

  // Stage the specified files
  const addResult = await execa('git', ['add', ...files], {
    cwd,
    reject: false,
  });

  if (addResult.exitCode !== 0) {
    debug(`git add failed: ${addResult.stderr}`);
    return false;
  }

  // Verify there are staged changes
  const diffResult = await execa('git', ['diff', '--cached', '--name-only'], {
    cwd,
    reject: false,
  });

  if (diffResult.exitCode !== 0 || !diffResult.stdout.trim()) {
    debug('No staged changes after git add');
    return false;
  }

  // Commit
  const commitResult = await execa('git', ['commit', '-m', message], {
    cwd,
    reject: false,
  });

  if (commitResult.exitCode !== 0) {
    debug(`git commit failed: ${commitResult.stderr}`);
    return false;
  }

  return true;
}
