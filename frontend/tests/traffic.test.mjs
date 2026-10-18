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
    formatExactBytes
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
    assert.match(formatExactBytes(result.used, 'en'), /8,000,000,000,000,000,000,000/)
})
test('localized units and decimal precision', () => {
    assert.equal(formatTrafficBytes(0n, 'ru'), '0\u00a0МБ')
    assert.equal(formatTrafficBytes(25n * 1024n ** 3n, 'ru'), '25,0\u00a0ГБ')
    assert.equal(formatTrafficBytes(25n * 1024n ** 3n, 'en'), '25.0\u00a0GB')
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
