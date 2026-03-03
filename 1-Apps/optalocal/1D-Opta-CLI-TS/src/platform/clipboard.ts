import { execa } from 'execa';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Extracts an image from the macOS clipboard and saves it to a temporary file.
 * Returns the path to the saved file, or null if no image was found or an error occurred.
 */
export async function extractClipboardImage(): Promise<string | null> {
  if (process.platform !== 'darwin') {
    return null;
  }
  
  const timestamp = Date.now();
  const filename = `opta-clipboard-${timestamp}.png`;
  const tempPath = join(tmpdir(), filename);
  
  const script = `
    set theFile to (open for access POSIX file "${tempPath}" with write permission)
    try
      write (the clipboard as «class PNGf») to theFile
      close access theFile
      return "SUCCESS"
    on error errMsg
      close access theFile
      return "ERROR"
    end try
  `;
  
  try {
    const { stdout } = await execa('osascript', ['-e', script]);
    if (stdout.trim() === 'SUCCESS') {
      return tempPath;
    }
  } catch {
    // Ignore error, probably no image in clipboard
  }
  
  return null;
}
