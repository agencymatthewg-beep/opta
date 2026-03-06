import test from 'node:test'
import assert from 'node:assert/strict'

import {
    getConnectErrorMessage,
    resolveConnectRoute,
    shouldCompleteConnect,
} from '../lib/connect-hints'

test('resolveConnectRoute uses tunnel for WAN when present', () => {
    const route = resolveConnectRoute({
        host: '192.168.1.2',
        port: 1234,
        via: 'wan',
        tunnelUrl: 'https://edge.example.com/',
    })

    assert.equal(route.targetUrl, 'https://edge.example.com')
    assert.equal(route.routeLabel, 'Via Cloudflare Tunnel')
    assert.equal(route.routeWarning, null)
})

test('resolveConnectRoute falls back to direct host for WAN without tunnel', () => {
    const route = resolveConnectRoute({
        host: '192.168.1.2',
        port: 1234,
        via: 'wan',
    })

    assert.equal(route.targetUrl, 'http://192.168.1.2:1234')
    assert.equal(route.routeLabel, 'Via Direct Host Fallback')
    assert.match(route.routeWarning ?? '', /missing/i)
})

test('shouldCompleteConnect only succeeds after target URL is active', () => {
    assert.equal(
        shouldCompleteConnect({
            initialized: true,
            status: 'connected',
            currentUrl: 'http://127.0.0.1:1234',
            targetUrl: 'http://192.168.1.2:1234',
        }),
        false
    )

    assert.equal(
        shouldCompleteConnect({
            initialized: true,
            status: 'connected',
            currentUrl: 'http://192.168.1.2:1234',
            targetUrl: 'http://192.168.1.2:1234',
        }),
        true
    )
})

test('getConnectErrorMessage maps known bootstrap errors', () => {
    assert.match(getConnectErrorMessage('invalid_host') ?? '', /invalid host/i)
    assert.match(getConnectErrorMessage('invalid_port') ?? '', /invalid port/i)
    assert.match(getConnectErrorMessage('other') ?? '', /bootstrap failed/i)
})
