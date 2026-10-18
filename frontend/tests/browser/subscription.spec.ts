import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { makeConfig, makeSubscription } from '../fixtures.mjs'

async function openPage(page: Page, { config = makeConfig(), user = {}, locale = 'en' } = {}) {
    await page.addInitScript((lang) => localStorage.setItem('i18nextLng', lang), locale)
    await page.route('**/assets/.app-config-v2.json?*', (route) => route.fulfill({ json: config }))
    await page.route('**/demo', async (route) => {
        const response = await route.fetch()
        const html = (await response.text()).replace(
            /data-panel="[^"]*"/,
            `data-panel="${Buffer.from(JSON.stringify(makeSubscription(user))).toString('base64')}"`
        )
        await route.fulfill({ response, body: html })
    })
    await page.goto('/demo')
    await expect(
        page.getByRole('heading', { name: config.brandingSettings.title, exact: true })
    ).toBeVisible()
}
async function wizard(page: Page) {
    await page.getByRole('button', { name: 'Connect a new device', exact: true }).click()
    return page.getByRole('dialog', { name: 'Connection setup', exact: true })
}

test('traffic remains accessible and username is absent', async ({ page }) => {
    await openPage(page)
    await expect(page.getByRole('progressbar', { name: /^LTE/ })).toHaveAttribute(
        'aria-valuenow',
        '0'
    )
    await expect(page.getByText('never-display-this-username')).toHaveCount(0)
    const toggle = page.getByRole('button', { name: 'Show details', exact: true })
    await toggle.press('Enter')
    await expect(page.getByRole('region')).toBeVisible()
    await expect(page.getByText('Expiry date')).toBeVisible()
    await page.getByRole('button', { name: 'Hide details', exact: true }).press('Space')
    await expect(page.getByRole('region')).not.toBeVisible()
    await page.getByRole('button', { name: /Exact usage/ }).focus()
    await expect(page.getByText('0 / 26,843,545,600', { exact: true })).toBeVisible()
})
for (const status of ['ACTIVE', 'EXPIRED', 'LIMITED', 'DISABLED'])
    test(`explicit ${status} status and exhausted traffic`, async ({ page }) => {
        await openPage(page, {
            user: { userStatus: status, trafficUsedBytes: String(30 * 1024 ** 3), daysLeft: 0 }
        })
        await expect(page.locator(`[data-status="${status}"]`)).toBeVisible()
        await expect(page.locator('[data-usage-color="red"]')).toBeVisible()
        await expect(page.getByRole('progressbar', { name: /^LTE/ })).toHaveAttribute(
            'aria-valuenow',
            '100'
        )
        const dialog = await wizard(page)
        if (status !== 'ACTIVE')
            await expect(dialog.getByText(/Your subscription is not active/)).toBeVisible()
        await expect(
            dialog.getByRole('button', { name: 'The app is installed, next' })
        ).toBeVisible()
    })
for (const layout of ['collapsed', 'expanded', 'cards', 'hidden'])
    test(`legacy subscription selector ${layout}`, async ({ page }) => {
        const config = makeConfig()
        config.uiConfig.subscriptionInfoBlockType = layout
        await openPage(page, { config })
        await expect(page.getByRole('progressbar', { name: /^LTE/ })).toHaveCount(
            layout === 'hidden' ? 0 : 1
        )
        if (layout !== 'hidden')
            await expect(
                page.getByRole('button', { name: 'Show details', exact: true })
            ).toBeVisible()
    })
const matrix = {
    'iPhone / iPad': ['incy', 'RabbitHole'],
    Android: ['incy', 'Happ', 'Clash Meta'],
    Windows: ['Koala Clash', 'Happ'],
    macOS: ['Koala Clash', 'Happ'],
    Linux: ['Koala Clash', 'Happ', 'Prizrak-Box'],
    'Android TV': ['Happ'],
    'Apple TV': ['Happ']
}
for (const [platform, apps] of Object.entries(matrix))
    test(`wizard clients: ${platform}`, async ({ page }) => {
        await openPage(page)
        const dialog = await wizard(page)
        await dialog.getByRole('button', { name: platform, exact: true }).click()
        await expect(dialog.getByRole('heading', { name: apps[0], exact: true })).toBeVisible()
        await expect(dialog.getByText('Recommended', { exact: true })).toBeVisible()
        if (apps.length > 1) {
            for (const app of apps.slice(1)) {
                await dialog.getByRole('button', { name: 'Choose another app' }).click()
                await dialog.getByRole('button', { name: app, exact: true }).click()
                await expect(dialog.getByRole('heading', { name: app, exact: true })).toBeVisible()
            }
        }
        await dialog.getByRole('button', { name: 'The app is installed, next' }).click()
        await expect(
            dialog.getByRole('heading', { name: 'Add your subscription', exact: true })
        ).toBeFocused()
        await expect(dialog.getByRole('heading', { name: 'Enable VPN', exact: true })).toBeVisible()
        await dialog.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(dialog.getByRole('heading', { name: apps.at(-1), exact: true })).toBeVisible()
    })
test('copy, QR, raw keys, completion, nested support and reopen', async ({ page }, info) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await openPage(page)
    await expect(page.getByRole('button', { name: /Copy subscription link/ })).toHaveCount(0)
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Android', exact: true }).click()
    await dialog.getByRole('button', { name: 'The app is installed, next' }).click()
    await expect(dialog.getByRole('link', { name: 'Add to incy', exact: true })).toHaveAttribute(
        'href',
        'incy://import/http://127.0.0.1:3334/demo'
    )
    await dialog.getByRole('button', { name: 'Copy subscription link', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('http://127.0.0.1:3334/demo')
    await dialog.getByRole('button', { name: /Show QR code/ }).click()
    await expect(dialog.getByRole('img', { name: /Scan in your VPN app/ })).toBeVisible()
    await dialog
        .getByRole('img', { name: /Scan in your VPN app/ })
        .screenshot({ path: info.outputPath('qr.png') })
    await dialog.getByRole('button', { name: 'Advanced connection options' }).click()
    await dialog.getByRole('button', { name: 'Copy link: Example location', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('vless://fixture@example.com:443#Example%20location')
    await dialog.getByRole('button', { name: 'Support', exact: true }).click()
    const support = page.getByRole('dialog', { name: 'Support', exact: true })
    await expect(support.getByRole('link', { name: 'support@tovarish.net' })).toHaveAttribute(
        'href',
        'mailto:support@tovarish.net'
    )
    await expect(support.getByRole('link', { name: 'Chat on Telegram' })).toHaveAttribute(
        'href',
        'https://t.me/tovarishvpnbot'
    )
    await page.keyboard.press('Escape')
    await expect(
        dialog.getByRole('heading', { name: 'Add your subscription', exact: true })
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: 'Done, you’re connected' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'support@tovarish.net' })).toBeVisible()
    await page.screenshot({ path: info.outputPath('completion.png'), fullPage: true })
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
    await expect(
        page.getByRole('button', { name: 'Connect a new device', exact: true })
    ).toBeFocused()
    const reopened = await wizard(page)
    await expect(reopened.getByRole('heading', { name: 'Choose your device' })).toBeVisible()
    await expect(reopened.getByRole('button', { name: 'Android', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
})
test('query imports encode the complete subscription URL', async ({ page }) => {
    await openPage(page)
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Linux', exact: true }).click()
    await dialog.getByRole('button', { name: 'The app is installed, next' }).click()
    await expect(dialog.getByRole('link', { name: 'Add to Koala Clash' })).toHaveAttribute(
        'href',
        'koala-clash://install-config?url=http%3A%2F%2F127.0.0.1%3A3334%2Fdemo'
    )
})
test('panel branding, instructions, empty configuration and featured fallback', async ({
    page
}) => {
    const config = makeConfig()
    config.brandingSettings.title = 'Custom brand'
    config.platforms.android.apps.forEach((app) => (app.featured = false))
    config.platforms.android.apps[0].blocks[0].description.en = 'Custom panel instructions'
    await openPage(page, { config })
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Android', exact: true }).click()
    await expect(dialog.getByText('Custom panel instructions')).toBeVisible()
    config.platforms = {}
    await openPage(page, { config })
    await wizard(page)
    await expect(page.getByText(/Instructions are not available/)).toBeVisible()
})
for (const result of ['ok', 'empty', 'error', 'expired'])
    test(`devices ${result}`, async ({ page }) => {
        await openPage(page)
        await page.route('**/api/devices', (route) =>
            route.fulfill({
                status: result === 'error' ? 503 : result === 'expired' ? 401 : 200,
                json: {
                    total: result === 'empty' ? 0 : 1,
                    limit: null,
                    devices:
                        result === 'empty'
                            ? []
                            : [
                                  {
                                      deviceModel: 'Test phone',
                                      platform: 'Android',
                                      osVersion: '16',
                                      createdAt: '2026-01-01T00:00:00Z',
                                      updatedAt: '2026-10-01T00:00:00Z'
                                  }
                              ]
                }
            })
        )
        await page.getByRole('button', { name: 'Devices', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Devices', exact: true })
        if (result === 'ok') {
            await expect(dialog.getByText('Test phone')).toBeVisible()
            await expect(dialog.getByText('No device limit')).toBeVisible()
        }
        if (result === 'empty')
            await expect(dialog.getByText('No registered devices yet')).toBeVisible()
        if (result === 'error') await expect(dialog.getByText(/We couldn’t load/)).toBeVisible()
        if (result === 'expired')
            await expect(dialog.getByRole('button', { name: 'Reload page' })).toBeVisible()
        await expect(dialog.getByText(/does not indicate whether a device is online/)).toBeVisible()
    })
test('Russian unlimited and indefinite expiry', async ({ page }) => {
    await openPage(page, {
        locale: 'ru',
        user: { trafficLimitBytes: '0', expiresAt: '2099-01-01T00:00:00Z' }
    })
    await expect(page.getByText('Безлимитный трафик')).toBeVisible()
    await expect(page.getByText('Сброс ежемесячно')).toBeVisible()
    await page.getByRole('button', { name: 'Подробнее', exact: true }).click()
    await expect(page.getByText('Бессрочно')).toBeVisible()
})
test('mobile/tablet/desktop: primary action, platforms, RTL and reduced motion', async ({
    page
}, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page, { locale: 'ru', user: { trafficUsedBytes: String(20 * 1024 ** 3) } })
    for (const [name, width, height] of [
        ['mobile', 360, 640],
        ['tablet', 768, 1024],
        ['desktop', 1280, 900]
    ] as const) {
        await page.setViewportSize({ width, height })
        const bounds = await page
            .getByRole('button', { name: 'Подключить новое устройство', exact: true })
            .boundingBox()
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true
        )
        await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
    }
    await page.getByRole('button', { name: 'Подключить новое устройство', exact: true }).click()
    const platformButtons = page
        .getByRole('group', { name: 'Выберите устройство' })
        .getByRole('button')
    await expect(platformButtons).toHaveCount(7)
    const positions = await platformButtons.evaluateAll((elements) =>
        elements.map((el) => el.getBoundingClientRect().top)
    )
    expect(new Set(positions).size).toBe(1)
    await page.screenshot({ path: info.outputPath('wizard.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Change language' }).click()
    await page.getByRole('menuitem', { name: /فارسی/ }).click()
    await expect(page.locator('[dir="rtl"]').first()).toBeAttached()
})
test('touch accordion and wizard', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 390, height: 844 }
    })
    const page = await context.newPage()
    await openPage(page)
    await page.getByRole('button', { name: /Exact usage/ }).tap()
    await expect(page.getByText('0 / 26,843,545,600', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Show details', exact: true }).tap()
    await expect(page.getByRole('region')).toBeVisible()
    await page.getByRole('button', { name: 'Connect a new device', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'Connection setup' })).toBeVisible()
    await context.close()
})

test('Russian mobile setup actions wrap without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await openPage(page, { locale: 'ru' })
    await page.getByRole('button', { name: 'Подключить новое устройство', exact: true }).click()
    await page.getByRole('button', { name: 'Приложение установлено, дальше' }).click()
    const qr = page.getByRole('button', { name: /Показать QR-код/ })
    await expect(qr).toBeVisible()
    const clipped = await qr.evaluate((el) =>
        [...el.querySelectorAll('span')].some(
            (span) =>
                span.scrollWidth > span.clientWidth + 1 || span.scrollHeight > span.clientHeight + 1
        )
    )
    expect(clipped).toBe(false)
    await qr.click()
    await expect(
        page.getByRole('img', {
            name: 'Отсканируйте код в VPN-приложении, чтобы добавить подписку.'
        })
    ).toBeVisible()
})
