import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';

export interface GenUIResult {
  filePath: string;
  opened: boolean;
}

/**
 * Extracts HTML from a markdown string and writes it to a tracked GenUI directory.
 * If autoOpenBrowser is true, attempts to open the file natively.
 */
export async function handleGenUIResponse(
  content: string,
  prefix: string,
  autoOpenBrowser: boolean
): Promise<GenUIResult | null> {
  const match = content.match(/```html\n([\s\S]*?)```/);
  const htmlContent = match ? match[1] : content.trim().startsWith('<!DOCTYPE html>') ? content : null;

  if (!htmlContent) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${prefix}-${timestamp}.html`;
  const dirPath = path.join(process.cwd(), '.opta', 'genui');
  
  await fs.mkdir(dirPath, { recursive: true });
  const filePath = path.join(dirPath, filename);
  
  await fs.writeFile(filePath, htmlContent, 'utf8');

  let opened = false;
  if (autoOpenBrowser) {
    try {
      const platform = process.platform;
      const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      await execa(cmd, [filePath], { detached: true, stdio: 'ignore' });
      opened = true;
    } catch {
      // Ignore errors opening the browser
    }
  }

  return { filePath, opened };
}
