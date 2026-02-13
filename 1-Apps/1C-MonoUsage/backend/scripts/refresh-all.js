const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');

const BACKEND_DIR = path.join(os.homedir(), 'Synced/Opta/1-Apps/1D-MonoUsage/backend');
const SCRIPTS_DIR = path.join(BACKEND_DIR, 'scripts');

console.log('MonoUsage - Full Refresh');
console.log('========================\n');

// Step 1: Sync keys from markdown (optional — skips gracefully if no keys file)
console.log('Step 1: Syncing API keys...');
try {
    execFileSync('node', [path.join(SCRIPTS_DIR, 'sync-keys.js')], { stdio: 'inherit' });
} catch (e) {
    console.log('  Key sync skipped:', e.message);
}

console.log('');

// Step 2: Fetch all API data
console.log('Step 2: Fetching API data...');
try {
    execFileSync('node', [path.join(SCRIPTS_DIR, 'fetch-apis.js')], { stdio: 'inherit' });
} catch (e) {
    console.error('  Fetch failed:', e.message);
}

console.log('\n========================');
console.log('Refresh complete');
