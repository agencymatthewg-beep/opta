import { emitKeypressEvents } from 'node:readline';
import chalk from 'chalk';
import { colorizeOptaWord } from './brand.js';
import { fitTextToWidth, padToWidth } from '../utils/terminal-layout.js';
import { clamp } from '../utils/common.js';

type ActivePane = 'sections' | 'items';

export interface PaneMenuItem {
  id: string;
  label: string;
  description?: string;
}

export interface PaneMenuSection {
  id: string;
  label: string;
  color?: string;
  items: PaneMenuItem[];
}

export interface PaneMenuOptions {
  title: string;
  subtitle?: string;
  sections: PaneMenuSection[];
  instructions?: string;
  loop?: boolean;
  initialSectionIndex?: number;
  initialItemIndex?: number;
}

export interface PaneMenuSelection {
  sectionId: string;
  itemId: string;
  sectionIndex: number;
  itemIndex: number;
}

function moveIndex(current: number, delta: number, size: number, loop: boolean): number {
  if (size <= 0) return 0;
  if (loop) return (current + delta + size) % size;
  return clamp(current + delta, 0, size - 1);
}

function windowRange(total: number, selected: number, maxRows: number): { start: number; end: number } {
  if (total <= maxRows) return { start: 0, end: total };
  const half = Math.floor(maxRows / 2);
  const start = clamp(selected - half, 0, total - maxRows);
  return { start, end: start + maxRows };
}

function paintChip(text: string, color?: string): string {
  if (!color) return chalk.cyan(text);
  return chalk.hex(color)(text);
}

function renderFrame(
  options: PaneMenuOptions,
  sectionIndex: number,
  itemIndexes: number[],
  activePane: ActivePane,
): void {
  const columns = process.stdout.columns ?? 120;
  const rows = process.stdout.rows ?? 36;
  const sections = options.sections;
  const selectedSection = sections[sectionIndex];
  const selectedItems = selectedSection?.items ?? [];
  const itemIndex = itemIndexes[sectionIndex] ?? 0;

  const usableColumns = Math.max(20, columns - 3);
  const minLeft = 8;
  const minRight = 10;
  let leftWidth = clamp(Math.floor(usableColumns * 0.32), minLeft, Math.min(42, Math.max(minLeft, usableColumns - minRight)));
  let rightWidth = usableColumns - leftWidth;
  if (rightWidth < minRight) {
    leftWidth = Math.max(minLeft, leftWidth - (minRight - rightWidth));
    rightWidth = usableColumns - leftWidth;
  }
  const maxRows = clamp(rows - 12, 6, 18);

  const leftRange = windowRange(sections.length, sectionIndex, maxRows);
  const rightRange = windowRange(selectedItems.length, itemIndex, maxRows);

  const title = colorizeOptaWord(options.title);
  const subtitle = options.subtitle ? chalk.dim(options.subtitle) : '';
  const instructions = options.instructions ?? '←/→ switch panes · ↑/↓ scroll (infinite) · Enter select · q exit';

  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(`${chalk.bold(title)}\n`);
  if (subtitle) process.stdout.write(`${subtitle}\n`);
  process.stdout.write(`${chalk.dim(instructions)}\n\n`);

  const leftHeader = fitTextToWidth('Areas', leftWidth, { pad: true });
  const rightHeader = fitTextToWidth(selectedSection?.label ?? 'Commands', rightWidth, { pad: true });
  process.stdout.write(
    `${activePane === 'sections' ? chalk.bgMagenta.black(` ${leftHeader} `) : chalk.magenta(` ${leftHeader} `)} ` +
    `${activePane === 'items' ? chalk.bgCyan.black(` ${rightHeader} `) : chalk.cyan(` ${rightHeader} `)}\n`,
  );

  for (let i = 0; i < maxRows; i++) {
    const sIdx = leftRange.start + i;
    const itIdx = rightRange.start + i;
    const section = sections[sIdx];
    const item = selectedItems[itIdx];

    let left = padToWidth('', leftWidth + 2);
    if (section) {
      const raw = `${sIdx === sectionIndex ? '●' : '○'} ${section.label}`;
      const padded = ` ${fitTextToWidth(raw, leftWidth, { pad: true })} `;
      if (sIdx === sectionIndex) {
        left = activePane === 'sections'
          ? chalk.bgHex('#4c1d95').white(padded)
          : chalk.hex('#a78bfa')(padded);
      } else {
        left = paintChip(padded, section.color);
      }
    }

    let right = padToWidth('', rightWidth + 2);
    if (item) {
      const raw = `${itIdx === itemIndex ? '◆' : '·'} /${item.id} ${item.description ?? ''}`;
      const padded = ` ${fitTextToWidth(raw, rightWidth, { pad: true })} `;
      if (itIdx === itemIndex) {
        right = activePane === 'items'
          ? chalk.bgHex('#0e7490').white(padded)
          : chalk.cyan(padded);
      } else {
        right = chalk.dim(padded);
      }
    }

    process.stdout.write(`${left} ${right}\n`);
  }

  const selectedItem = selectedItems[itemIndex];
  process.stdout.write('\n');
  if (selectedItem) {
    process.stdout.write(
      chalk.dim('Selected: ') +
      chalk.cyan(`/${selectedItem.id}`) +
      (selectedItem.description ? chalk.dim(` — ${selectedItem.description}`) : '') +
      '\n',
    );
  } else {
    process.stdout.write(chalk.dim('No commands in this area') + '\n');
  }
}

export async function runPaneMenu(options: PaneMenuOptions): Promise<PaneMenuSelection | null> {
  const sections = options.sections.filter((s) => s.items.length > 0);
  if (!process.stdin.isTTY || sections.length === 0) return null;

  const loop = options.loop ?? true;
  let sectionIndex = clamp(options.initialSectionIndex ?? 0, 0, sections.length - 1);
  const itemIndexes = sections.map((s) => clamp(options.initialItemIndex ?? 0, 0, Math.max(0, s.items.length - 1)));
  let activePane: ActivePane = 'sections';

  emitKeypressEvents(process.stdin);
  const previousRawMode = process.stdin.isRaw ?? false;
  if (!previousRawMode) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write('\x1b[?25l');

  return new Promise<PaneMenuSelection | null>((resolve) => {
    const cleanup = (): void => {
      process.stdin.off('keypress', onKeypress);
      if (!previousRawMode && process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write('\x1b[?25h');
    };

    const finish = (value: PaneMenuSelection | null): void => {
      cleanup();
      process.stdout.write('\x1b[0m\n');
      resolve(value);
    };

    const onKeypress = (_str: string, key: { name?: string; ctrl?: boolean }): void => {
      const section = sections[sectionIndex]!;
      const currentItemCount = Math.max(1, section.items.length);

      if (key.ctrl && key.name === 'c') {
        finish(null);
        return;
      }

      if (key.name === 'q' || key.name === 'escape') {
        finish(null);
        return;
      }

      if (key.name === 'tab') {
        activePane = activePane === 'sections' ? 'items' : 'sections';
        renderFrame({ ...options, sections }, sectionIndex, itemIndexes, activePane);
        return;
      }

      if (key.name === 'left') {
        activePane = 'sections';
        renderFrame({ ...options, sections }, sectionIndex, itemIndexes, activePane);
        return;
      }

      if (key.name === 'right') {
        activePane = 'items';
        renderFrame({ ...options, sections }, sectionIndex, itemIndexes, activePane);
        return;
      }

      if (key.name === 'up') {
        if (activePane === 'sections') {
          sectionIndex = moveIndex(sectionIndex, -1, sections.length, loop);
        } else {
          itemIndexes[sectionIndex] = moveIndex(itemIndexes[sectionIndex] ?? 0, -1, currentItemCount, loop);
        }
        renderFrame({ ...options, sections }, sectionIndex, itemIndexes, activePane);
        return;
      }

      if (key.name === 'down') {
        if (activePane === 'sections') {
          sectionIndex = moveIndex(sectionIndex, 1, sections.length, loop);
        } else {
          itemIndexes[sectionIndex] = moveIndex(itemIndexes[sectionIndex] ?? 0, 1, currentItemCount, loop);
        }
        renderFrame({ ...options, sections }, sectionIndex, itemIndexes, activePane);
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        if (activePane === 'sections') {
          activePane = 'items';
          renderFrame({ ...options, sections }, sectionIndex, itemIndexes, activePane);
          return;
        }
        const itemIndex = itemIndexes[sectionIndex] ?? 0;
        const item = sections[sectionIndex]!.items[itemIndex];
        if (!item) return;
        finish({
          sectionId: sections[sectionIndex]!.id,
          itemId: item.id,
          sectionIndex,
          itemIndex,
        });
      }
    };

    process.stdin.on('keypress', onKeypress);
    renderFrame({ ...options, sections }, sectionIndex, itemIndexes, activePane);
  });
}
