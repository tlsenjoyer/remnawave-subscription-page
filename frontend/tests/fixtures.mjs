import { GetSubscriptionInfoByShortUuidCommand } from '@remnawave/backend-contract'
import {
    BASE_TRANSLATION_LABELS,
    LANGUAGE_CODES,
    SubscriptionPageRawConfigSchema
} from '@remnawave/subscription-page-types'

const localized = (en, ru = en) =>
    Object.fromEntries(LANGUAGE_CODES.map((locale) => [locale, locale === 'ru' ? ru : en]))
const translations = Object.fromEntries(
    Object.entries(BASE_TRANSLATION_LABELS).map(([key, label]) => [key, localized(label)])
)
Object.assign(translations, {
    bandwidth: localized('LTE traffic', 'LTE трафик'),
    active: localized('Active', 'Активна'),
    expired: localized('Expired', 'Истекла'),
    status: localized('Status', 'Статус'),
    expires: localized('Expiry date', 'Дата окончания'),
    indefinitely: localized('Indefinitely', 'Бессрочно'),
    installationGuideHeader: localized('Connect your device', 'Подключить устройство'),
    connectionKeysHeader: localized('Connection keys', 'Ключи подключения'),
    getLink: localized('Get link', 'Получить ссылку'),
    copyLink: localized('Copy link', 'Скопировать ссылку')
})
const icon =
    '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 18h4"/></svg>'
const apps = [
    {
        name: 'Happ',
        featured: true,
        svgIconKey: 'device',
        blocks: [
            {
                title: localized('Install the app', 'Установите приложение'),
                description: localized(
                    'Install the application for your device, then import your subscription.',
                    'Установите приложение на устройство, затем добавьте подписку.'
                ),
                svgIconKey: 'device',
                svgIconColor: 'violet',
                buttons: [
                    {
                        type: 'external',
                        link: 'https://example.com/download',
                        text: localized('Download', 'Скачать'),
                        svgIconKey: 'device'
                    },
                    {
                        type: 'copyButton',
                        link: '{{SUBSCRIPTION_LINK}}',
                        text: localized('Copy subscription', 'Копировать подписку'),
                        svgIconKey: 'device'
                    },
                    {
                        type: 'subscriptionLink',
                        link: 'happ://add/{{SUBSCRIPTION_LINK}}',
                        text: localized('Import subscription', 'Добавить подписку'),
                        svgIconKey: 'device'
                    }
                ]
            }
        ]
    },
    {
        name: 'Hiddify',
        featured: false,
        svgIconKey: 'device',
        blocks: [
            {
                title: localized('Alternative app'),
                description: localized('Alternative instructions'),
                svgIconKey: 'device',
                svgIconColor: '#e986bf',
                buttons: []
            }
        ]
    }
]

export function makeConfig(overrides = {}) {
    return SubscriptionPageRawConfigSchema.parse({
        version: '1',
        locales: ['en', 'ru', 'fa'],
        brandingSettings: {
            title: 'Subscription',
            logoUrl: '',
            supportUrl: 'https://example.com/support'
        },
        uiConfig: { subscriptionInfoBlockType: 'collapsed', installationGuidesBlockType: 'cards' },
        baseSettings: {
            metaTitle: 'Subscription',
            metaDescription: 'Subscription access',
            showConnectionKeys: true,
            hideGetLinkButton: false
        },
        baseTranslations: translations,
        svgLibrary: { device: icon },
        platforms: Object.fromEntries(
            ['ios', 'android', 'windows', 'macos', 'linux', 'androidTV', 'appleTV'].map(
                (platform) => [
                    platform,
                    {
                        displayName: localized(platform),
                        svgIconKey: 'device',
                        apps: structuredClone(apps)
                    }
                ]
            )
        ),
        ...overrides
    })
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
