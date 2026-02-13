import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadVersion(): string {
  try {
    return require('../../package.json').version;
  } catch {
    try {
      return require('../package.json').version;
    } catch {
      return '0.0.0';
    }
  }
}

export const VERSION: string = loadVersion();
