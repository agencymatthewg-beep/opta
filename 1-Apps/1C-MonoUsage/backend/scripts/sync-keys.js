const fs = require('fs');
const path = require('path');
const os = require('os');

// Paths — resolved from home directory
const HOME = os.homedir();
const BACKEND_DIR = path.join(HOME, 'Synced/Opta/1-Apps/1D-MonoUsage/backend');
const ENV_FILE = path.join(BACKEND_DIR, '.env');

// Search multiple known locations for API-KEYS.md
const KEYS_SEARCH_PATHS = [
    path.join(HOME, 'Synced/AI26/openclaw-shared/research/API-KEYS.md'),
    path.join(HOME, 'openclaw-shared/research/API-KEYS.md'),
];

function findKeysFile() {
    for (const p of KEYS_SEARCH_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function parseMarkdownKeys(content) {
    const keys = {};

    // MiniMax API Keys
    const minimaxMatch = content.match(/\|\s*\*\*API Key\*\*\s*\|\s*`(sk-[^`]+)`\s*\|/);
    if (minimaxMatch) {
        keys['MINIMAX_SHARED_KEY'] = minimaxMatch[1];
        console.log('  Found: MINIMAX_SHARED_KEY');
    }

    const minimaxCodingMatch = content.match(/MINIMAX_CODING_KEY[=:]\s*["']?([^\s"'\n]+)/);
    if (minimaxCodingMatch) {
        keys['MINIMAX_CODING_KEY'] = minimaxCodingMatch[1];
        console.log('  Found: MINIMAX_CODING_KEY');
    }

    // Anthropic API Key
    const anthropicMatch = content.match(/ANTHROPIC_API_KEY[=:]\s*["']?([^\s"'\n]+)/);
    if (anthropicMatch) {
        keys['ANTHROPIC_API_KEY'] = anthropicMatch[1];
        console.log('  Found: ANTHROPIC_API_KEY');
    }

    // OpenRouter API Key
    const openrouterMatch = content.match(/OPENROUTER_API_KEY[=:]\s*["']?([^\s"'\n]+)/);
    if (openrouterMatch) {
        keys['OPENROUTER_API_KEY'] = openrouterMatch[1];
        console.log('  Found: OPENROUTER_API_KEY');
    }

    // Perplexity API Key
    const perplexityMatch = content.match(/PERPLEXITY_API_KEY[=:]\s*["']?([^\s"'\n]+)/);
    if (perplexityMatch) {
        keys['PERPLEXITY_API_KEY'] = perplexityMatch[1];
        console.log('  Found: PERPLEXITY_API_KEY');
    }

    // Claude OAuth Token
    const claudeTokenMatch = content.match(/\*\*Token:\*\*\s*`(sk-ant-[^`]+)`/);
    if (claudeTokenMatch) {
        keys['CLAUDE_OAUTH_TOKEN'] = claudeTokenMatch[1];
        console.log('  Found: CLAUDE_OAUTH_TOKEN');
    }

    return keys;
}

function updateEnv(keys) {
    let existing = '';
    if (fs.existsSync(ENV_FILE)) {
        existing = fs.readFileSync(ENV_FILE, 'utf8');
    }

    const lines = existing.split('\n').filter(l => l.trim());
    const current = new Map(lines.map(l => {
        const eq = l.indexOf('=');
        return eq > 0 ? [l.slice(0, eq), l.slice(eq + 1)] : [l, ''];
    }));

    let changed = false;
    for (const [k, v] of Object.entries(keys)) {
        if (!current.has(k) || current.get(k) !== v) {
            current.set(k, v);
            changed = true;
            console.log(`  ${current.has(k) ? 'Updated' : 'Added'}: ${k}`);
        }
    }

    if (changed) {
        const output = Array.from(current.entries()).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
        fs.writeFileSync(ENV_FILE, output);
        console.log('  .env updated');
    } else {
        console.log('  .env already up to date');
    }
}

// Main
console.log('MonoUsage - Syncing API keys...\n');

const keysFile = findKeysFile();
if (!keysFile) {
    console.log('  No API-KEYS.md found in known locations.');
    console.log('  Searched:', KEYS_SEARCH_PATHS.join('\n           '));
    console.log('\n  Create .env manually at:', ENV_FILE);
    console.log('  Required keys: ANTHROPIC_API_KEY, MINIMAX_SHARED_KEY, MINIMAX_CODING_KEY, OPENROUTER_API_KEY, PERPLEXITY_API_KEY');
    process.exit(0);
}

console.log(`  Reading: ${keysFile}\n`);
const content = fs.readFileSync(keysFile, 'utf8');
const foundKeys = parseMarkdownKeys(content);
console.log(`\n  Found ${Object.keys(foundKeys).length} keys`);
updateEnv(foundKeys);
