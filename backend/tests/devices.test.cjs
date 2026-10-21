const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const phoneId = createHash('sha256').update('phone').digest('hex');
const { readFileSync } = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const { JwtService } = require('@nestjs/jwt');

// Compile the decorated controller with the project's installed TypeScript.
const filename = path.resolve(__dirname, '../src/modules/webpage/devices.controller.ts');
const controllerModule = new Module(filename, module);
controllerModule.paths = module.paths;
controllerModule.require = (id) => {
    if (id === '@common/axios') return { AxiosService: class {} };
    if (id === '@common/decorators/get-ip') return { ClientIp: () => () => {} };
    return require(id);
};
controllerModule._compile(
    ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
        },
    }).outputText,
    filename,
);
const { DevicesController } = controllerModule.exports;

const date = '2026-10-01T12:00:00.000Z';
function fixture() {
    const user = {
        id: 42,
        shortUuid: 'demo',
        username: 'owner',
        hwidDeviceLimit: 5,
        status: 'ACTIVE',
        trafficLimitBytes: 0,
        trafficLimitStrategy: 'NO_RESET',
        expireAt: date,
        telegramId: null,
        email: null,
        description: null,
        tag: null,
        externalSquadUuid: null,
        trojanPassword: 'secret',
        ssPassword: 'secret',
        vlessUuid: '00000000-0000-4000-8000-000000000000',
        lastTriggeredThreshold: 0,
        subRevokedAt: null,
        lastTrafficResetAt: null,
        createdAt: date,
        updatedAt: date,
        subscriptionUrl: 'https://example.test/demo',
        activeInternalSquads: [],
        userTraffic: {
            usedTrafficBytes: 0,
            lifetimeUsedTrafficBytes: 0,
            onlineAt: null,
            firstConnectedAt: null,
            lastConnectedNodeUuid: null,
        },
    };
    const device = {
        hwid: 'phone',
        userId: 42,
        platform: 'Android',
        osVersion: '16',
        deviceModel: 'Phone',
        userAgent: 'private-agent',
        requestIp: '192.0.2.1',
        createdAt: date,
        updatedAt: date,
    };
    const jwt = new JwtService({ secret: 'fixture-secret' });
    const request = {
        cookies: {
            device_session: jwt.sign(
                { sub: 'demo' },
                { audience: 'subscription-devices', expiresIn: '30m' },
            ),
        },
        headers: { 'x-subscription-id': 'demo' },
    };
    const calls = [];
    const panel = {
        getSubscriptionInfo: async () => ({
            isOk: true,
            response: { response: { isFound: true, user: { username: 'owner' } } },
        }),
        getUserByUsername: async () => ({ isOk: true, response: { response: user } }),
        axiosInstance: {
            get: async (url) => {
                calls.push(['get', url]);
                return { data: { response: { total: 1, devices: [device] } } };
            },
            post: async (url, body) => {
                calls.push(['post', url, body]);
                return { data: { response: { total: 0, devices: [] } } };
            },
        },
    };
    const controller = new DevicesController(jwt, panel);
    const response = {
        setHeader: (name, value) => assert.deepEqual([name, value], ['Cache-Control', 'no-store']),
    };
    return { controller, request, response, panel, calls, user, device };
}
const status = (expected) => (error) => error.getStatus() === expected;

test('list exposes a device identifier without panel-private fields', async () => {
    const f = fixture();
    const result = await f.controller.list(f.request, f.response, '127.0.0.1');
    assert.equal(result.devices[0].id, phoneId);
    for (const field of ['hwid', 'userId', 'userAgent', 'requestIp'])
        assert.equal(field in result.devices[0], false);
});
test('delete uses the verified owner and returns the updated allowance', async () => {
    const f = fixture();
    assert.deepEqual(
        await f.controller.remove(f.request, f.response, '127.0.0.1', { id: phoneId }),
        { total: 0, limit: 5, devices: [] },
    );
    assert.deepEqual(f.calls, [
        ['get', '/api/hwid/devices/42'],
        ['post', '/api/hwid/devices/delete', { userId: 42, hwid: 'phone' }],
    ]);
});
test('delete rejects missing, expired and cross-subscription sessions before contacting the panel', async () => {
    for (const kind of ['missing', 'expired', 'wrong-page']) {
        const f = fixture();
        if (kind === 'missing') delete f.request.cookies.device_session;
        if (kind === 'expired')
            f.request.cookies.device_session = new JwtService({ secret: 'fixture-secret' }).sign(
                { sub: 'demo' },
                { audience: 'subscription-devices', expiresIn: -1 },
            );
        if (kind === 'wrong-page') f.request.headers['x-subscription-id'] = 'someone-else';
        await assert.rejects(
            f.controller.remove(f.request, f.response, '', { id: phoneId }),
            status(401),
        );
        assert.deepEqual(f.calls, []);
    }
});
test('delete validates the body and refuses browser-supplied ownership', async () => {
    for (const body of [null, {}, { id: '' }, { id: 42 }, { id: phoneId, userId: 999 }]) {
        const f = fixture();
        await assert.rejects(f.controller.remove(f.request, f.response, '', body), status(400));
        assert.deepEqual(f.calls, []);
    }
});
test('delete rejects devices outside the verified subscription and revoked links', async () => {
    for (const kind of ['unknown-device', 'wrong-owner', 'revoked']) {
        const f = fixture();
        if (kind === 'wrong-owner') f.device.userId = 999;
        if (kind === 'revoked') f.user.shortUuid = 'revoked';
        await assert.rejects(
            f.controller.remove(f.request, f.response, '', { id: '0'.repeat(64) }),
            status(kind === 'unknown-device' ? 404 : 503),
        );
        assert.equal(
            f.calls.some(([method]) => method === 'post'),
            false,
        );
    }
});
test('panel permission failures do not report a successful deletion', async () => {
    const f = fixture();
    f.panel.axiosInstance.post = async () => {
        throw new Error('403 Forbidden');
    };
    await assert.rejects(
        f.controller.remove(f.request, f.response, '', { id: phoneId }),
        status(503),
    );
});
