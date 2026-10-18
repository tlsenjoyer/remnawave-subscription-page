import { GetSubscriptionInfoByShortUuidCommand } from '@remnawave/backend-contract'
import { SubscriptionPageRawConfigSchema, LANGUAGE_CODES } from '@remnawave/subscription-page-types'
import { readFileSync } from 'node:fs'
const panelConfig = JSON.parse(
    readFileSync(new URL('../../config/tovarish-panel.json', import.meta.url), 'utf8')
)
function extendLocales(value) {
    if (!value || typeof value !== 'object') return value
    if (typeof value.en === 'string')
        return Object.fromEntries(
            LANGUAGE_CODES.map((locale) => [locale, value[locale] || value.en])
        )
    if (Array.isArray(value)) return value.map(extendLocales)
    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, extendLocales(item)])
    )
}
export function makeConfig(overrides = {}) {
    const config = extendLocales(structuredClone(panelConfig))
    config.locales = LANGUAGE_CODES
    config.baseSettings.showConnectionKeys = true
    return SubscriptionPageRawConfigSchema.parse({ ...config, ...overrides })
}
export function makeSubscription(overrides = {}) {
    const response = {
        isFound: true,
        user: {
            shortUuid: 'demo',
            username: 'never-display-this-username',
            daysLeft: 172,
            trafficUsed: '0 B',
            trafficLimit: '25 GB',
            lifetimeTrafficUsed: '0 B',
            trafficUsedBytes: '0',
            trafficLimitBytes: String(25 * 1024 ** 3),
            lifetimeTrafficUsedBytes: '0',
            expiresAt: '2027-04-08T12:00:00.000Z',
            isActive: true,
            userStatus: 'ACTIVE',
            trafficLimitStrategy: 'MONTH',
            ...overrides
        },
        links: ['vless://fixture@example.com:443#Example%20location'],
        ssConfLinks: {},
        subscriptionUrl: 'https://example.com/demo'
    }
    GetSubscriptionInfoByShortUuidCommand.ResponseSchema.parse({ response })
    return { response }
}
