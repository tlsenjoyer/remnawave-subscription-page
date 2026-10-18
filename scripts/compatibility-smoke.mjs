import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { makeConfig, makeSubscription } from '../frontend/tests/fixtures.mjs'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const {
    GetMetadataCommand, GetSubpageConfigsCommand, GetSubpageConfigCommand,
    GetSubscriptionInfoByShortUuidCommand, GetSubpageConfigByShortUuidCommand,
    REQUEST_TEMPLATE_TYPE_VALUES, REMNAWAVE_REAL_IP_HEADER
} = require('@remnawave/backend-contract')
const { APP_CONFIG_ROUTE_LEADING_PATH } = require('@remnawave/subscription-page-types')
const root = fileURLToPath(new URL('../', import.meta.url))
const uuid = '11111111-1111-4111-8111-111111111111'
const config = makeConfig()
const configEntry = { uuid, viewPosition: 0, name: 'Fixture', config }
const subscription = makeSubscription()
const forwarded = []
const payload = Buffer.from('dmxlc3M6Ly91bmNoYW5nZWQtc3Vic2NyaXB0aW9uCg==')
const pathOf = value => '/' + value.replace(/^\//, '')
const requests = new Map([
    [pathOf(GetMetadataCommand.url), { response: { version: '3.1.1', build: { time: '', number: '' }, git: { backend: { commitSha: '', branch: '', commitUrl: '' }, frontend: { commitSha: '', commitUrl: '' } } } }],
    [pathOf(GetSubpageConfigsCommand.url), { response: { total: 1, configs: [configEntry] } }],
    [pathOf(GetSubpageConfigCommand.url(uuid)), { response: configEntry }],
    [pathOf(GetSubscriptionInfoByShortUuidCommand.url('demo')), subscription],
    [pathOf(GetSubpageConfigByShortUuidCommand.url('demo')), { response: { subpageConfigUuid: uuid, webpageAllowed: true } }]
])
GetMetadataCommand.ResponseSchema.parse(requests.get(pathOf(GetMetadataCommand.url)))
GetSubpageConfigsCommand.ResponseSchema.parse(requests.get(pathOf(GetSubpageConfigsCommand.url)))

const panel = createServer(async (req, res) => {
    const parts = []
    for await (const part of req) parts.push(part)
    forwarded.push({ path: req.url, headers: req.headers, body: Buffer.concat(parts).toString() })
    if (req.url.startsWith('/api/sub/demo')) {
        res.writeHead(200, { 'content-type': 'text/plain', 'subscription-userinfo': 'upload=0; download=100; total=1000; expire=2000000000', 'profile-update-interval': '12' })
        res.end(payload)
    } else if (requests.has(req.url)) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(requests.get(req.url)))
    } else { res.writeHead(404); res.end() }
})
await new Promise(resolve => panel.listen(0, '127.0.0.1', resolve))
const panelPort = panel.address().port
const portProbe = createServer()
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve))
const appPort = portProbe.address().port
await new Promise(resolve => portProbe.close(resolve))
// Exercise the exact production layout, cookie policy and proxy checks in Docker.
const dockerImage = process.argv.includes('--docker') ? process.argv[process.argv.indexOf('--docker') + 1] : 'green-subpage:test'
const containerName = `green-subpage-smoke-${process.pid}`
const env = {
    ...process.env, APP_PORT: String(appPort), REMNAWAVE_PANEL_URL: `http://127.0.0.1:${panelPort}`,
    REMNAWAVE_API_TOKEN: 'fixture-token',
    SUBPAGE_CONFIG_UUID: uuid, CUSTOM_SUB_PREFIX: 'sub', TRUST_PROXY: '1'
}
const args = ['run', '--rm', '--network', 'host', '--name', containerName, ...['APP_PORT', 'REMNAWAVE_PANEL_URL', 'REMNAWAVE_API_TOKEN', 'SUBPAGE_CONFIG_UUID', 'CUSTOM_SUB_PREFIX', 'TRUST_PROXY'].flatMap(key => ['-e', `${key}=${env[key]}`]), dockerImage]
const app = spawn('docker', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''
app.stdout.on('data', data => { logs += data })
app.stderr.on('data', data => { logs += data })
const address = `http://127.0.0.1:${appPort}`
const proxyHeaders = { 'x-forwarded-for': '203.0.113.42', 'x-forwarded-proto': 'https', 'user-agent': 'Mozilla/5.0 smoke-test' }
try {
    let ready = false
    for (let attempt = 0; attempt < 240; attempt++) {
        if (app.exitCode !== null) throw new Error(`App exited ${app.exitCode}`)
        try { if ((await fetch(`${address}/internal/health`)).ok) { ready = true; break } } catch { /* starting */ }
        await delay(250)
    }
    assert.ok(ready, 'health endpoint became ready')
    const webpage = await fetch(`${address}/sub/demo`, { headers: proxyHeaders })
    assert.equal(webpage.status, 200)
    const html = await webpage.text()
    const embedded = JSON.parse(Buffer.from(html.match(/data-panel="([^"]+)"/)[1], 'base64').toString())
    assert.deepEqual(embedded, subscription, 'browser hydration payload unchanged')
    assert.ok(webpage.headers.get('x-robots-tag').includes('noindex'))
    const cookie = webpage.headers.getSetCookie().find(value => value.startsWith('session='))
    assert.ok(cookie.includes('HttpOnly'))
    assert.ok(cookie.includes('Secure'))
    const session = cookie.split(';')[0]
    const cfg = await fetch(`${address}${APP_CONFIG_ROUTE_LEADING_PATH}`, { headers: { ...proxyHeaders, cookie: session } })
    assert.equal(cfg.status, 200)
    assert.deepEqual(await cfg.json(), config, 'panel configuration response unchanged and unprefixed')
    const asset = html.match(/src="(\/assets\/[^" ]+\.js)"/)[1]
    assert.equal((await fetch(`${address}${asset}`, { headers: { ...proxyHeaders, cookie: session } })).status, 200)
    await assert.rejects(fetch(`${address}${APP_CONFIG_ROUTE_LEADING_PATH}`, { headers: proxyHeaders }), 'missing session is rejected')
    await assert.rejects(fetch(`${address}${APP_CONFIG_ROUTE_LEADING_PATH}`, { headers: { ...proxyHeaders, cookie: 'session=invalid' } }), 'invalid session is rejected')
    await assert.rejects(fetch(`${address}/sub/demo`, { headers: { 'user-agent': 'Mozilla/5.0' } }), 'production still requires reverse proxy headers')
    for (const suffix of ['', `/${REQUEST_TEMPLATE_TYPE_VALUES[0]}`]) {
        const response = await fetch(`${address}/sub/demo${suffix}`, { headers: { ...proxyHeaders, 'user-agent': 'subscription-client', authorization: 'Bearer should-not-forward' } })
        assert.equal(response.status, 200)
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), payload)
        assert.equal(response.headers.get('profile-update-interval'), '12')
        assert.equal(response.headers.get('subscription-userinfo'), 'upload=0; download=100; total=1000; expire=2000000000')
    }
    const subRequests = forwarded.filter(request => request.path.startsWith('/api/sub/demo'))
    assert.equal(subRequests.length, 2)
    for (const request of subRequests) {
        assert.equal(request.headers.authorization, undefined)
        assert.equal(request.headers[REMNAWAVE_REAL_IP_HEADER.toLowerCase()], '203.0.113.42')
    }
    assert.ok(forwarded.some(request => request.headers.authorization === 'Bearer fixture-token'))
    for (let attempt = 0; attempt < 30; attempt++) {
        const health = execFileSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', containerName], { encoding: 'utf8' }).trim()
        if (health === 'healthy') break
        await delay(1000)
    }
    assert.equal(execFileSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', containerName], { encoding: 'utf8' }).trim(), 'healthy')
    console.log('Compatibility smoke passed (production container + Docker health check).')
} catch (error) {
    console.error(logs.slice(-10000))
    throw error
} finally {
    try { execFileSync('docker', ['stop', '-t', '2', containerName], { stdio: 'ignore' }) } catch { /* already stopped */ }
    panel.closeAllConnections()
    panel.close()
}
