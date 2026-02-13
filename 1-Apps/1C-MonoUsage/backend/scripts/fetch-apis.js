const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// Paths — resolved from home directory, never hardcoded
const HOME = os.homedir();
const BACKEND_DIR = path.join(HOME, 'Synced/Opta/1-Apps/1D-MonoUsage/backend');
const DATA_FILE = path.join(BACKEND_DIR, 'data/latest.json');
const ENV_FILE = path.join(BACKEND_DIR, '.env');

// Load environment
if (fs.existsSync(ENV_FILE)) {
    require('dotenv').config({ path: ENV_FILE });
}

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Color thresholds: green <50%, yellow 50-80%, red >80%
function colorFromPercent(pct) {
    if (pct == null) return 'gray';
    if (pct < 0.5) return 'green';
    if (pct < 0.8) return 'yellow';
    return 'red';
}

// Minimal HTTPS GET — no external deps
function httpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const opts = {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'GET',
            headers: { 'User-Agent': 'MonoUsage/2.0', ...headers }
        };

        const req = https.request(opts, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch { resolve({ status: res.statusCode, data: body }); }
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

// ==================== FETCHERS ====================

// Anthropic — validates key via /v1/models (no public billing API)
async function fetchAnthropic(apiKey) {
    if (!apiKey) return { name: 'Anthropic', type: 'api', status: 'no_key', usage: null, limit: null, currency: 'USD', percent: null, color: 'gray' };

    try {
        const res = await httpGet('https://api.anthropic.com/v1/models', {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        });

        const ok = res.status === 200;
        return {
            name: 'Anthropic',
            type: 'api',
            status: ok ? 'active' : 'invalid_key',
            usage: null,
            limit: null,
            currency: 'USD',
            percent: null,
            color: ok ? 'green' : 'red',
            note: ok ? 'console.anthropic.com for usage' : 'Key rejected'
        };
    } catch (e) {
        return { name: 'Anthropic', type: 'api', status: 'error', usage: null, limit: null, currency: 'USD', percent: null, color: 'orange', note: e.message };
    }
}

// MiniMax — validates key, hardcoded plan limit (no public balance API)
async function fetchMiniMax(apiKey, label = 'MiniMax') {
    if (!apiKey) return { name: label, type: 'api', status: 'no_key', usage: null, limit: null, currency: 'CNY', percent: null, color: 'gray' };

    try {
        const res = await httpGet('https://api.minimax.io/anthropic/v1/models', {
            'Authorization': `Bearer ${apiKey}`
        });

        const ok = res.status === 200 || res.status === 404;
        return {
            name: label,
            type: 'api',
            status: ok ? 'active' : 'invalid',
            usage: null,
            limit: 500.00,
            currency: 'CNY',
            percent: null,
            color: ok ? 'green' : 'red',
            note: 'platform.minimax.io for balance'
        };
    } catch (e) {
        return { name: label, type: 'api', status: 'assumed_active', usage: null, limit: 500.00, currency: 'CNY', percent: null, color: 'green', note: 'API unreachable' };
    }
}

// OpenRouter — has real usage/limit data via /api/v1/auth/key
async function fetchOpenRouter(apiKey) {
    if (!apiKey) return { name: 'OpenRouter', type: 'api', status: 'no_key', usage: null, limit: null, currency: 'USD', percent: null, color: 'gray' };

    try {
        const res = await httpGet('https://openrouter.ai/api/v1/auth/key', {
            'Authorization': `Bearer ${apiKey}`
        });

        if (res.status === 200 && res.data && res.data.data) {
            const d = res.data.data;
            const usage = d.usage || 0;
            const limit = d.limit || null;
            const percent = limit ? usage / limit : null;

            return {
                name: d.label || 'OpenRouter',
                type: 'api',
                status: 'active',
                usage,
                limit,
                currency: 'USD',
                percent,
                color: colorFromPercent(percent),
                note: d.is_free_tier ? 'Free tier' : null
            };
        }

        return { name: 'OpenRouter', type: 'api', status: 'invalid_key', usage: null, limit: null, currency: 'USD', percent: null, color: 'red' };
    } catch (e) {
        return { name: 'OpenRouter', type: 'api', status: 'error', usage: null, limit: null, currency: 'USD', percent: null, color: 'orange', note: e.message };
    }
}

// Perplexity — validates key
async function fetchPerplexity(apiKey) {
    if (!apiKey) return { name: 'Perplexity', type: 'api', status: 'no_key', usage: null, limit: null, currency: 'USD', percent: null, color: 'gray' };

    try {
        const res = await httpGet('https://api.perplexity.ai/chat/completions', {
            'Authorization': `Bearer ${apiKey}`
        });

        const ok = res.status !== 401;
        return {
            name: 'Perplexity',
            type: 'api',
            status: ok ? 'active' : 'invalid_key',
            usage: null,
            limit: null,
            currency: 'USD',
            percent: null,
            color: ok ? 'green' : 'red'
        };
    } catch (e) {
        return { name: 'Perplexity', type: 'api', status: 'error', usage: null, limit: null, currency: 'USD', percent: null, color: 'orange', note: e.message };
    }
}

// Subscription placeholder — no API, just a status marker
function subscription(name, account) {
    return {
        name,
        type: 'subscription',
        account,
        status: 'active',
        usage: null,
        limit: null,
        currency: null,
        percent: null,
        color: 'blue',
        note: 'Check provider dashboard'
    };
}

// ==================== MAIN ====================

async function main() {
    console.log('MonoUsage - Fetching API data...\n');
    const state = {};

    console.log('  Anthropic...');
    state['anthropic'] = await fetchAnthropic(process.env.ANTHROPIC_API_KEY);

    console.log('  MiniMax Shared...');
    state['minimax_shared'] = await fetchMiniMax(process.env.MINIMAX_SHARED_KEY, 'MiniMax Shared');

    console.log('  MiniMax Coding...');
    state['minimax_coding'] = await fetchMiniMax(process.env.MINIMAX_CODING_KEY, 'MiniMax Coding');

    console.log('  OpenRouter...');
    state['openrouter'] = await fetchOpenRouter(process.env.OPENROUTER_API_KEY);

    console.log('  Perplexity...');
    state['perplexity'] = await fetchPerplexity(process.env.PERPLEXITY_API_KEY);

    console.log('  Subscriptions...');
    state['claude_code_matt'] = subscription('Claude Code (Matt)', 'matthew@xpulsenetwork.com');
    state['claude_code_yjs'] = subscription('Claude Code (YJS)', 'official@yellowjacket.biz');

    // Write data
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    console.log(`\nSaved to ${DATA_FILE}`);

    // Summary
    console.log('\nSummary:');
    const icons = { green: '🟢', yellow: '🟡', red: '🔴', blue: '🔵', orange: '🟠', gray: '⚪' };
    Object.values(state).forEach(s => {
        const i = icons[s.color] || '⚪';
        const sym = s.currency === 'CNY' ? '¥' : '$';
        const spend = s.usage != null ? ` (${sym}${Number(s.usage).toFixed(2)})` : '';
        console.log(`  ${i} ${s.name}: ${s.status}${spend}`);
    });
}

main().catch(console.error);
