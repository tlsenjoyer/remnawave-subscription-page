import { LANGUAGE_CODES } from '@remnawave/subscription-page-types'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
    getResetCaption,
    getTrafficCopy
} from '../src/widgets/main/subscription-info/traffic-copy.ts'
import {
    getTrafficMetrics,
    formatTrafficBytes,
    formatTrafficMegabytes
} from '../src/widgets/main/subscription-info/traffic.utils.ts'

for (const [used, color, progress] of [
    ['0', 'green', 0],
    ['7999', 'green', 79.99],
    ['8000', 'yellow', 80],
    ['9999', 'yellow', 99.99],
    ['10000', 'red', 100],
    ['12000', 'red', 100]
]) {
    test(`traffic threshold ${used}/10000`, () => {
        const result = getTrafficMetrics({ trafficUsedBytes: used, trafficLimitBytes: '10000' })
        assert.equal(result.color, color)
        assert.equal(result.progress, progress)
        assert.equal(result.used, BigInt(used))
    })
}
test('unlimited and invalid counters never divide by zero or imply a finite quota', () => {
    assert.equal(
        getTrafficMetrics({ trafficUsedBytes: '100', trafficLimitBytes: '0' }).unlimited,
        true
    )
    assert.equal(
        getTrafficMetrics({ trafficUsedBytes: '100', trafficLimitBytes: '0' }).percentage,
        null
    )
    assert.equal(
        getTrafficMetrics({ trafficUsedBytes: 'bad', trafficLimitBytes: '100' }).color,
        'gray'
    )
})
test('integer arithmetic preserves large counters and exact 80% boundary', () => {
    const result = getTrafficMetrics({
        trafficUsedBytes: '8000000000000000000000',
        trafficLimitBytes: '10000000000000000000000'
    })
    assert.equal(result.progress, 80)
    assert.equal(result.color, 'yellow')
})
test('localized units and decimal precision', () => {
    assert.equal(formatTrafficBytes(0n, 'ru'), '0\u00a0МБ')
    assert.equal(formatTrafficBytes(25n * 1024n ** 3n, 'ru'), '25\u00a0ГБ')
    assert.equal(formatTrafficBytes(25n * 1024n ** 3n, 'en'), '25\u00a0GB')
    assert.equal(formatTrafficBytes(1572864n, 'ru'), '1,5\u00a0МБ')
    assert.equal(formatTrafficBytes(1572864n, 'en'), '1.5\u00a0MB')
})
test('every supported locale has translated UI copy and reset schedules', () => {
    for (const locale of LANGUAGE_CODES) {
        assert.ok(Object.values(getTrafficCopy(locale)).every(Boolean))
        if (locale !== 'en') assert.notEqual(getTrafficCopy(locale).show, getTrafficCopy('en').show)
    }
    assert.equal(getResetCaption('MONTH', 'ru'), 'Сброс ежемесячно')
    assert.equal(getResetCaption('MONTH_ROLLING', 'en'), 'Resets monthly')
    assert.equal(getResetCaption('DAY', 'en'), 'Resets daily')
    assert.equal(getResetCaption('WEEK', 'en'), 'Resets weekly')
    assert.equal(getResetCaption('NO_RESET', 'en'), 'No automatic reset')
    assert.equal(getTrafficCopy('xx').show, 'Show details')
})

import { SubscriptionPageRawConfigSchema } from '@remnawave/subscription-page-types'
import { readFileSync } from 'node:fs'

import { formatClientLink } from '../src/widgets/main/dashboard/client-link.ts'
import { getDashboardCopy } from '../src/widgets/main/dashboard/dashboard-copy.ts'

test('dashboard translations cover every supported locale and fall back to English', () => {
    const english = getDashboardCopy('en')
    for (const locale of LANGUAGE_CODES) {
        const copy = getDashboardCopy(locale)
        assert.deepEqual(Object.keys(copy), Object.keys(english))
        assert.ok(
            Object.values(copy).every((value) => typeof value === 'string' && value.length > 0)
        )
        assert.ok(copy.successText.includes('{app}'), `${locale}.successText`)
        if (locale !== 'en') {
            for (const key of [
                'connect',
                'deviceError',
                'deleteDevice',
                'deletingDevice',
                'deleteDeviceError',
                'deviceHint',
                'privateLink',
                'preparing',
                'installTitle',
                'change',
                'returnToSubscription',
                'manualFallback',
                'success',
                'successText'
            ])
                assert.notEqual(copy[key], english[key], `${locale}.${key}`)
        }
    }
    assert.deepEqual(getDashboardCopy('xx'), english)
})
test('client query imports encode reserved characters while path imports retain the URL', () => {
    const url = 'https://example.com/sub/a?token=one&name=two#three'
    assert.equal(
        formatClientLink('clash://install-config?url={{SUBSCRIPTION_LINK}}', url),
        'clash://install-config?url=' + encodeURIComponent(url)
    )
    assert.equal(
        formatClientLink('incy://import/{{SUBSCRIPTION_LINK}}', url),
        'incy://import/' + url
    )
    assert.equal(formatClientLink('{{USERNAME}}', url), '{{USERNAME}}')
})
test('importable panel configuration retains the schema and exact client matrix', () => {
    const config = SubscriptionPageRawConfigSchema.parse(
        JSON.parse(
            readFileSync(new URL('../../config/tovarish-panel.json', import.meta.url), 'utf8')
        )
    )
    const matrix = {
        ios: ['incy', 'RabbitHole'],
        android: ['incy', 'Happ', 'Clash Meta'],
        windows: ['Koala Clash', 'Happ'],
        macos: ['Koala Clash', 'Happ'],
        linux: ['Koala Clash', 'Happ', 'Prizrak-Box'],
        androidTV: ['Happ'],
        appleTV: ['Happ']
    }
    assert.deepEqual(Object.keys(config.platforms), Object.keys(matrix))
    for (const [platform, names] of Object.entries(matrix)) {
        assert.deepEqual(
            config.platforms[platform].apps.map((app) => app.name),
            names
        )
        assert.equal(config.platforms[platform].apps.filter((app) => app.featured).length, 1)
        for (const app of config.platforms[platform].apps) assert.equal(app.blocks.length, 3)
    }
})

test('monthly reset day comes from creation in UTC with safe fallback', () => {
    for (const strategy of ['MONTH', 'MONTH_ROLLING']) {
        assert.equal(getResetCaption(strategy, 'ru', '2026-10-18T23:30:00Z'), 'Сброс 18 числа ежемесячно')
        assert.equal(getResetCaption(strategy, 'en', '2026-01-31T00:00:00Z'), 'Resets on day 31 of every month')
        assert.equal(getResetCaption(strategy, 'en', 'invalid'), 'Resets monthly')
    }
    assert.equal(getResetCaption('DAY', 'en', '2026-10-18T00:00:00Z'), 'Resets daily')
})
test('tooltip always uses localized megabytes including small and unlimited counters', () => {
    assert.equal(formatTrafficMegabytes(null, 'en'), '—')
    assert.equal(formatTrafficMegabytes(0n, 'en'), '0')
    assert.equal(formatTrafficMegabytes(1n, 'en'), '0')
    assert.equal(formatTrafficMegabytes(1572864n, 'ru'), '1,5')
    assert.equal(formatTrafficMegabytes(1700000n, 'en'), '1.6')
    assert.equal(formatTrafficMegabytes(25000n * 1024n ** 2n, 'ru'), new Intl.NumberFormat('ru').format(25000))
    assert.equal(formatTrafficMegabytes(25n * 1024n ** 3n, 'en'), '25,600')
})
