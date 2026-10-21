const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/modules/webpage/webpage.service.ts');
const serviceModule = new Module(filename, module);
serviceModule.paths = module.paths;
serviceModule.require = (id) => {
    if (id === '@common/utils') return { isDevelopment: () => true };
    return id.startsWith('@common/') ? {} : require(id);
};
serviceModule._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, experimentalDecorators: true },
}).outputText, filename);
const { WebpageService } = serviceModule.exports;

for (const [strategy, owner, expected] of [
    ['MONTH', { shortUuid: 'demo', createdAt: '2026-10-18T12:00:00Z', password: 'private' }, '2026-10-18T12:00:00.000Z'],
    ['MONTH_ROLLING', { shortUuid: 'demo', createdAt: '2026-01-31T00:00:00Z' }, '2026-01-31T00:00:00.000Z'],
    ['MONTH', null, undefined],
    ['MONTH', { shortUuid: 'other', createdAt: '2026-10-18T12:00:00Z' }, undefined],
    ['MONTH', { shortUuid: 'demo', createdAt: 'invalid' }, undefined],
    ['DAY', null, undefined],
]) test(`creation metadata: ${strategy} ${JSON.stringify(owner)}`, async () => {
    let calls = 0;
    const config = { getOrThrow: () => 'test', get: () => undefined };
    const panel = {
        getSubscriptionInfo: async () => ({ isOk: true, response: { response: {
            user: { username: 'owner', shortUuid: 'demo', trafficLimitStrategy: strategy },
            links: [], ssConfLinks: {},
        } } }),
        getSubpageConfig: async () => ({ isOk: true, response: {} }),
        getUserByUsername: async (ip, username) => {
            calls++;
            assert.equal(ip, '127.0.0.1');
            assert.equal(username, 'owner');
            return owner ? { isOk: true, response: { response: owner } } : { isOk: false };
        },
    };
    const service = new WebpageService(config, panel, { sign: () => 'session' });
    service.getBaseSettings = () => ({ showConnectionKeys: true });
    service.generateJwtForCookie = () => 'session';
    service.indexTemplate = (data) => data;
    let rendered;
    const res = {
        cookie() {}, type() { return this; }, send(data) { rendered = data; },
        socket: { destroy() { assert.fail('page should render even when metadata is unavailable'); } },
    };
    await service.serveWebpage('127.0.0.1', { headers: {} }, res, 'demo');
    const data = JSON.parse(Buffer.from(rendered.panelData, 'base64').toString());
    assert.equal(data.response.subscriptionCreatedAt, expected);
    assert.equal(calls, strategy === 'DAY' ? 0 : 1);
    assert.ok(!JSON.stringify(data).includes('private'));
});
