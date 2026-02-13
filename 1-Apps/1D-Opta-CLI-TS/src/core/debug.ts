let verboseEnabled = false;
let debugEnabled = false;

export function setVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
  if (enabled) verboseEnabled = true;
}

export function verbose(message: string): void {
  if (verboseEnabled) {
    console.error(`[verbose] ${message}`);
  }
}

export function debug(message: string): void {
  if (debugEnabled) {
    console.error(`[debug] ${message}`);
  }
}

export function isVerbose(): boolean {
  return verboseEnabled;
}

export function isDebug(): boolean {
  return debugEnabled;
}
