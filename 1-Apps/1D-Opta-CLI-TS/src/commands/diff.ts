import chalk from 'chalk';
import { isGitRepo, gitDiff, getModifiedFiles } from '../git/utils.js';
import { listCheckpoints } from '../git/checkpoints.js';

interface DiffOptions {
  session?: string;
}

export async function diff(opts?: DiffOptions): Promise<void> {
  const cwd = process.cwd();

  if (!(await isGitRepo(cwd))) {
    console.log(chalk.yellow('Not a git repository.'));
    return;
  }

  if (opts?.session) {
    const checkpoints = await listCheckpoints(cwd, opts.session);
    if (checkpoints.length === 0) {
      console.log(chalk.dim('No checkpoints for this session.'));
      return;
    }
    console.log(chalk.bold(`Session ${opts.session} — ${checkpoints.length} checkpoints:`));
    for (const cp of checkpoints) {
      console.log(`  #${cp.n}  ${chalk.cyan(cp.tool)}  ${cp.path}  ${chalk.dim(cp.timestamp)}`);
    }
    return;
  }

  const modifiedFiles = await getModifiedFiles(cwd);
  if (modifiedFiles.length === 0) {
    console.log(chalk.dim('No uncommitted changes.'));
    return;
  }

  console.log(chalk.bold(`${modifiedFiles.length} file(s) changed:\n`));
  const diffOutput = await gitDiff(cwd);
  console.log(diffOutput);
}
