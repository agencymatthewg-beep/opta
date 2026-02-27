import chalk from 'chalk';

export function renderPercentBar(percent: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const ratio = clamped / 100;
  const filled = Math.round(ratio * width);
  const empty = Math.max(0, width - filled);
  const pctText = `${Math.round(clamped)}%`;
  const filledBar = 'O'.repeat(filled);
  const emptyBar = 'o'.repeat(empty);
  return `${chalk.hex('#8b5cf6')(filledBar)}${chalk.hex('#312e81')(emptyBar)} ${chalk.hex('#22d3ee')(pctText)}`;
}

export interface StepProgressTracker {
  tick(message?: string): void;
  set(current: number, message?: string): void;
  done(message?: string): void;
  fail(message?: string): void;
}

export interface SegmentedStepProgressTracker {
  tick(segment: string, message?: string): void;
  set(segment: string, current: number, message?: string): void;
  done(message?: string): void;
  fail(message?: string): void;
}

interface ProgressSegmentConfig {
  key: string;
  label: string;
  totalSteps: number;
}

interface ProgressSegmentState {
  key: string;
  label: string;
  total: number;
  current: number;
  message?: string;
}

export function createStepProgressTracker(
  totalSteps: number,
  title: string,
  enabled = true,
): StepProgressTracker {
  const total = Math.max(1, totalSteps);
  let current = 0;

  const render = (symbol: string, message?: string): void => {
    if (!enabled) return;
    const percent = Math.round((Math.max(0, Math.min(total, current)) / total) * 100);
    const line = `${symbol} ${chalk.bold(title)} ${renderPercentBar(percent, 24)}${message ? ` ${chalk.dim(message)}` : ''}`;
    console.log(line);
  };

  const finishLine = (): void => {
    // no-op: keep output append-only to avoid cursor-control ANSI sequences
  };

  return {
    tick(message?: string): void {
      current = Math.min(total, current + 1);
      render(chalk.cyan('⏳'), message);
    },
    set(next: number, message?: string): void {
      current = Math.max(0, Math.min(total, next));
      render(chalk.cyan('⏳'), message);
    },
    done(message?: string): void {
      current = total;
      render(chalk.green('✓'), message ?? 'done');
      finishLine();
    },
    fail(message?: string): void {
      render(chalk.red('✗'), message ?? 'failed');
      finishLine();
    },
  };
}

export function createSegmentedStepProgressTracker(
  segments: readonly ProgressSegmentConfig[],
  title: string,
  enabled = true,
): SegmentedStepProgressTracker {
  const states = segments
    .map((segment) => ({
      key: segment.key,
      label: segment.label,
      total: Math.max(1, segment.totalSteps),
      current: 0,
      message: undefined,
    }))
    .filter((segment) => segment.key.trim().length > 0);

  const safeStates: ProgressSegmentState[] = states.length > 0
    ? states
    : [{ key: 'default', label: 'Progress', total: 1, current: 0 }];

  const total = Math.max(
    1,
    safeStates.reduce((sum, segment) => sum + segment.total, 0),
  );
  const labelWidth = Math.max(...safeStates.map((segment) => segment.label.length), 7);

  const findSegment = (key: string): ProgressSegmentState =>
    safeStates.find((segment) => segment.key === key) ?? safeStates[0]!;

  const render = (symbol: string, headline?: string): void => {
    if (!enabled) return;

    const completed = safeStates.reduce((sum, segment) => sum + segment.current, 0);
    const percent = Math.round((Math.max(0, Math.min(total, completed)) / total) * 100);
    const lines = [
      `${symbol} ${chalk.bold(title)} ${renderPercentBar(percent, 24)}${headline ? ` ${chalk.dim(headline)}` : ''}`,
      ...safeStates.map((segment) => {
        const segmentPercent = Math.round((Math.max(0, Math.min(segment.total, segment.current)) / segment.total) * 100);
        const label = segment.label.padEnd(labelWidth, ' ');
        const detail = segment.message ? ` ${chalk.dim(segment.message)}` : '';
        return `  ${chalk.bold(label)} ${renderPercentBar(segmentPercent, 24)}${detail}`;
      }),
    ];

    console.log(lines.join('\n'));
  };

  const finish = (): void => {
    // no-op: append-only output, nothing to clean up
  };

  return {
    tick(segmentKey: string, message?: string): void {
      const segment = findSegment(segmentKey);
      segment.current = Math.min(segment.total, segment.current + 1);
      segment.message = message;
      render(chalk.cyan('⏳'), message);
    },
    set(segmentKey: string, current: number, message?: string): void {
      const segment = findSegment(segmentKey);
      segment.current = Math.max(0, Math.min(segment.total, current));
      segment.message = message;
      render(chalk.cyan('⏳'), message);
    },
    done(message?: string): void {
      for (const segment of safeStates) {
        segment.current = segment.total;
      }
      render(chalk.green('✓'), message ?? 'done');
      finish();
    },
    fail(message?: string): void {
      render(chalk.red('✗'), message ?? 'failed');
      finish();
    },
  };
}
