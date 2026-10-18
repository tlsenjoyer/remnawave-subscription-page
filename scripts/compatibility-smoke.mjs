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
    REQUEST_TEMPLATE_TYPE_VALUES, REMNAWAVE_REAL_IP_HEADER, GetUserByUsernameCommand, GetUserHwidDevicesCommand
} = require('@remnawave/backend-contract')
const { APP_CONFIG_ROUTE_LEADING_PATH } = require('@remnawave/subscription-page-types')
const root = fileURLToPath(new URL('../', import.meta.url))
const uuid = '11111111-1111-4111-8111-111111111111'
const prefix = process.env.SMOKE_PREFIX ?? 'sub'
const publicRoot = prefix ? '/' + prefix : ''
const config = makeConfig()
const configEntry = { uuid, viewPosition: 0, name: 'Fixture', config }
const subscription = makeSubscription()
const forwarded = []
const payload = Buffer.from('dmxlc3M6Ly91bmNoYW5nZWQtc3Vic2NyaXB0aW9uCg==')
const pathOf = value => '/' + value.replace(/^\//, '')
const subscriptionPaths = new Set(['/api/sub/demo', `/api/sub/demo/${REQUEST_TEMPLATE_TYPE_VALUES[0]}`])
const requests = new Map([
    [pathOf(GetMetadataCommand.url), { response: { version: '3.1.1', build: { time: '', number: '' }, git: { backend: { commitSha: '', branch: '', commitUrl: '' }, frontend: { commitSha: '', commitUrl: '' } } } }],
    [pathOf(GetSubpageConfigsCommand.url), { response: { total: 1, configs: [configEntry] } }],
    [pathOf(GetSubpageConfigCommand.url(uuid)), { response: configEntry }],
    [pathOf(GetSubscriptionInfoByShortUuidCommand.url('demo')), subscription],
    [pathOf(GetSubpageConfigByShortUuidCommand.url('demo')), { response: { subpageConfigUuid: uuid, webpageAllowed: true } }]
])
const owner = (id, shortUuid, username) => ({ response: {
    id, shortUuid, username, status: 'ACTIVE', trafficLimitBytes: 10000, trafficLimitStrategy: 'MONTH', expireAt: '2027-04-08T12:00:00Z', telegramId: null, email: null, description: null, tag: null,
    hwidDeviceLimit: id === 1 ? 5 : null, externalSquadUuid: null, trojanPassword: 'fixture-secret', vlessUuid: uuid, ssPassword: 'fixture-secret', lastTriggeredThreshold: 0, subRevokedAt: null, lastTrafficResetAt: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', subscriptionUrl: 'https://example.com/' + shortUuid, activeInternalSquads: [], userTraffic: { usedTrafficBytes: 0, lifetimeUsedTrafficBytes: 0, onlineAt: null, firstConnectedAt: null, lastConnectedNodeUuid: null },
} })
const deviceData = id => ({ response: { total: 1, devices: [{ hwid: 'never-expose-hardware-id', userId: id, platform: 'Android', osVersion: '16', deviceModel: 'Phone ' + id, userAgent: 'never-expose-agent', requestIp: '192.0.2.1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }] } })
requests.set(pathOf(GetUserByUsernameCommand.url(subscription.response.user.username)), owner(1, 'demo', subscription.response.user.username))
requests.set(pathOf(GetUserByUsernameCommand.url('second-user')), owner(2, 'other', 'second-user'))
requests.set(pathOf(GetSubscriptionInfoByShortUuidCommand.url('other')), makeSubscription({ shortUuid: 'other', username: 'second-user' }))
requests.set(pathOf(GetSubpageConfigByShortUuidCommand.url('other')), { response: { subpageConfigUuid: uuid, webpageAllowed: true } })
requests.set(pathOf(GetUserHwidDevicesCommand.url('1')), deviceData(1))
requests.set(pathOf(GetUserHwidDevicesCommand.url('2')), deviceData(2))
let rejectDevices = false
GetMetadataCommand.ResponseSchema.parse(requests.get(pathOf(GetMetadataCommand.url)))
GetSubpageConfigsCommand.ResponseSchema.parse(requests.get(pathOf(GetSubpageConfigsCommand.url)))

const panel = createServer(async (req, res) => {
    const parts = []
    for await (const part of req) parts.push(part)
    forwarded.push({ path: req.url, headers: req.headers, body: Buffer.concat(parts).toString() })
    if (rejectDevices && req.url.startsWith('/api/hwid/')) { res.writeHead(403); res.end(); return }
    if (subscriptionPaths.has(req.url)) {
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
    SUBPAGE_CONFIG_UUID: uuid, CUSTOM_SUB_PREFIX: prefix, TRUST_PROXY: '1'
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
    const webpage = await fetch(`${address}${publicRoot}/demo`, { headers: proxyHeaders })
    assert.equal(webpage.status, 200)
    const html = await webpage.text()
    const embedded = JSON.parse(Buffer.from(html.match(/data-panel="([^"]+)"/)[1], 'base64').toString())
    assert.deepEqual(embedded, subscription, 'browser hydration payload unchanged')
    assert.ok(webpage.headers.get('x-robots-tag').includes('noindex'))
    const cookie = webpage.headers.getSetCookie().find(value => value.startsWith('session='))
    assert.ok(cookie.includes('HttpOnly'))
    assert.ok(cookie.includes('Secure'))
    const session = cookie.split(';')[0]
    const deviceCookie = webpage.headers.getSetCookie().find(value => value.startsWith('device_session='))
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', `Path=${publicRoot}/api/devices`]) assert.ok(deviceCookie.includes(attribute), attribute)
    const deviceSession = deviceCookie.split(';')[0]
    const deviceRequest = (cookie, query = '', subject = 'demo') => fetch(`${address}${publicRoot}/api/devices${query}`, { headers: { ...proxyHeaders, cookie, 'x-subscription-id': subject } })

    assert.equal((await deviceRequest('')).status, 401)
    assert.equal((await deviceRequest('device_session=invalid')).status, 401)
    assert.equal((await deviceRequest(session.replace('session=', 'device_session='))).status, 401, 'config JWT cannot authorize devices')
    const first = await deviceRequest(deviceSession, '?userId=2')
    assert.equal(first.status, 200)
    assert.equal(first.headers.get('cache-control'), 'no-store')
    const firstData = await first.json()
    assert.equal(firstData.limit, 5)
    assert.equal(firstData.devices[0].deviceModel, 'Phone 1', 'browser user ID ignored')
    for (const hidden of ['hwid','userId','requestIp','userAgent']) assert.equal(firstData.devices[0][hidden], undefined)
    const secondPage = await fetch(`${address}${publicRoot}/other`, { headers: proxyHeaders })
    const secondCookie = secondPage.headers.getSetCookie().find(value => value.startsWith('device_session=')).split(';')[0]
    const secondData = await (await deviceRequest(secondCookie, '', 'other')).json()
    assert.equal(secondData.devices[0].deviceModel, 'Phone 2', 'sessions isolate subscription owners')
    assert.equal(secondData.limit, null)
    assert.equal((await deviceRequest(secondCookie)).status, 401, 'a different subscription tab cannot show the wrong devices')
    const devicePath = pathOf(GetUserHwidDevicesCommand.url('1'))
    requests.set(devicePath, { response: { total: 0, devices: [] } })
    assert.equal((await (await deviceRequest(deviceSession)).json()).total, 0)
    requests.set(devicePath, deviceData(2))
    assert.equal((await deviceRequest(deviceSession)).status, 503, 'upstream device owner mismatch is rejected')
    requests.set(devicePath, deviceData(1))
    rejectDevices = true
    assert.equal((await deviceRequest(deviceSession)).status, 503, 'missing HWID permission is graceful')
    rejectDevices = false
    const ownerPath = pathOf(GetUserByUsernameCommand.url(subscription.response.user.username))
    requests.set(ownerPath, owner(1, 'revoked-link', subscription.response.user.username))
    assert.equal((await deviceRequest(deviceSession)).status, 503, 'revoked subscription cannot use old cookie')
    requests.set(ownerPath, owner(1, 'demo', subscription.response.user.username))
    const expiredTokenScript = `const fs=require('fs'),crypto=require('crypto');const env=fs.readFileSync('/proc/1/environ','utf8').split(String.fromCharCode(0));const secret=env.find(x=>x.startsWith('INTERNAL_JWT_SECRET=')).split('=')[1];const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({sub:'demo',aud:'subscription-devices',exp:1})).toString('base64url');process.stdout.write(h+'.'+p+'.'+crypto.createHmac('sha256',secret).update(h+'.'+p).digest('base64url'))`
    const expiredToken = execFileSync('docker', ['exec', containerName, 'node', '-e', expiredTokenScript], { encoding: 'utf8' })
    assert.equal((await deviceRequest('device_session=' + expiredToken)).status, 401)
    assert.ok(html.includes('data-support-email="support@tovarish.net"'))
    const cfg = await fetch(`${address}${APP_CONFIG_ROUTE_LEADING_PATH}`, { headers: { ...proxyHeaders, cookie: session } })
    assert.equal(cfg.status, 200)
    assert.deepEqual(await cfg.json(), config, 'panel configuration response unchanged and unprefixed')
    const asset = html.match(/src="(\/assets\/[^" ]+\.js)"/)[1]
    assert.equal((await fetch(`${address}${asset}`, { headers: { ...proxyHeaders, cookie: session } })).status, 200)
    await assert.rejects(fetch(`${address}${APP_CONFIG_ROUTE_LEADING_PATH}`, { headers: proxyHeaders }), 'missing session is rejected')
    await assert.rejects(fetch(`${address}${APP_CONFIG_ROUTE_LEADING_PATH}`, { headers: { ...proxyHeaders, cookie: 'session=invalid' } }), 'invalid session is rejected')
    await assert.rejects(fetch(`${address}${publicRoot}/demo`, { headers: { 'user-agent': 'Mozilla/5.0' } }), 'production still requires reverse proxy headers')
    for (const suffix of ['', `/${REQUEST_TEMPLATE_TYPE_VALUES[0]}`]) {
        const response = await fetch(`${address}${publicRoot}/demo${suffix}`, { headers: { ...proxyHeaders, 'user-agent': 'subscription-client', authorization: 'Bearer should-not-forward' } })
        assert.equal(response.status, 200)
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), payload)
        assert.equal(response.headers.get('profile-update-interval'), '12')
        assert.equal(response.headers.get('subscription-userinfo'), 'upload=0; download=100; total=1000; expire=2000000000')
    }
    const subRequests = forwarded.filter(request => subscriptionPaths.has(request.path))
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
    await delay(500)
    console.error(logs.slice(-10000))
    console.error('Mock panel paths:', forwarded.map(request => request.path))
    throw error
} finally {
    try { execFileSync('docker', ['stop', '-t', '2', containerName], { stdio: 'ignore' }) } catch { /* already stopped */ }
    panel.closeAllConnections()
    panel.close()
}
