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

test('collapsed card: traffic, keyboard expansion, exact byte details and no username', async ({
    page
}) => {
    await openPage(page)
    await expect(page.getByRole('progressbar', { name: /^LTE/ })).toHaveAttribute(
        'aria-valuenow',
        '0'
    )
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Resets monthly')).toBeVisible()
    await expect(page.getByText('never-display-this-username')).toHaveCount(0)
    const toggle = page.getByRole('button', { name: 'Show details', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region')).toBeVisible()
    await expect(page.getByText('Expiry date')).toBeVisible()
    await page.getByRole('button', { name: 'Hide details', exact: true }).press('Space')
    await expect(page.getByRole('region')).not.toBeVisible()
    await page.getByRole('button', { name: /Exact usage/ }).focus()
    await expect(page.getByText('0 / 26,843,545,600', { exact: true })).toBeVisible()
})

for (const status of ['ACTIVE', 'EXPIRED', 'LIMITED', 'DISABLED']) {
    test(`visible status ${status} with exhausted traffic`, async ({ page }) => {
        await openPage(page, {
            user: { userStatus: status, trafficUsedBytes: String(30 * 1024 ** 3), daysLeft: 0 }
        })
        const card = page.locator(`[data-status="${status}"]`)
        await expect(card).toBeVisible()
        await expect(
            card
                .getByText(
                    {
                        ACTIVE: 'Active',
                        EXPIRED: 'Expired',
                        LIMITED: 'Limited',
                        DISABLED: 'Disabled'
                    }[status]!,
                    { exact: true }
                )
                .first()
        ).toBeVisible()
        await expect(card.locator('[data-usage-color="red"]')).toBeVisible()
        await expect(page.getByRole('progressbar', { name: /^LTE/ })).toHaveAttribute(
            'aria-valuenow',
            '100'
        )
        await expect(page.getByText('Traffic limit reached')).toBeVisible()
    })
}

for (const layout of ['collapsed', 'expanded', 'cards', 'hidden']) {
    test(`panel subscription layout ${layout}`, async ({ page }) => {
        await openPage(page, {
            config: makeConfig({
                uiConfig: {
                    subscriptionInfoBlockType: layout,
                    installationGuidesBlockType: 'cards'
                }
            })
        })
        await expect(page.getByRole('progressbar', { name: /^LTE/ })).toHaveCount(
            layout === 'hidden' ? 0 : 1
        )
        await expect(page.getByText('never-display-this-username')).toHaveCount(0)
        if (layout === 'expanded' || layout === 'cards')
            await expect(page.getByText('Expiry date')).toBeVisible()
    })
}

for (const layout of ['cards', 'timeline', 'accordion', 'minimal']) {
    test(`panel guide layout ${layout}, apps and configured colors`, async ({ page }) => {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
        await openPage(page, {
            config: makeConfig({
                uiConfig: {
                    subscriptionInfoBlockType: 'collapsed',
                    installationGuidesBlockType: layout
                }
            })
        })
        await expect(page.getByText('Install the app', { exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Copy subscription', exact: true }).click()
        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toBe('http://127.0.0.1:3334/demo')
        await page.getByRole('button', { name: 'Hiddify', exact: true }).click()
        await expect(page.getByText('Alternative app', { exact: true })).toBeVisible()
        await page.locator('select').selectOption('android')
        await expect(page.getByText('Install the app', { exact: true })).toBeVisible()
    })
}

test('Russian, unlimited usage, monthly reset and indefinite expiry', async ({ page }) => {
    await openPage(page, {
        locale: 'ru',
        user: { trafficLimitBytes: '0', expiresAt: '2099-01-01T00:00:00.000Z' }
    })
    await expect(page.getByText('LTE трафик', { exact: true })).toBeVisible()
    await expect(page.getByText('Сброс ежемесячно')).toBeVisible()
    await expect(page.getByText('Безлимитный трафик')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: /^LTE/ })).not.toHaveAttribute(
        'aria-valuenow'
    )
    await page.getByRole('button', { name: 'Подробнее', exact: true }).click()
    await expect(page.getByText('Бессрочно')).toBeVisible()
})

test('panel text, logo, empty platforms and visibility controls remain editable', async ({
    page
}) => {
    const config = makeConfig()
    config.brandingSettings.title = 'Custom panel brand'
    config.brandingSettings.logoUrl = `data:image/svg+xml,${encodeURIComponent(config.svgLibrary.device)}`
    config.baseTranslations.bandwidth.en = 'Custom panel quota label'
    config.platforms = {}
    config.baseSettings.hideGetLinkButton = true
    await openPage(page, { config })
    await expect(page.getByText('Custom panel quota label')).toBeVisible()
    await expect(page.getByAltText('logo')).toBeVisible()
    await expect(page.getByText('Connect your device', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Get link', exact: true })).toHaveCount(0)
})

test('subscription and connection-key QR dialogs still copy the original links', async ({
    page
}) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await openPage(page)
    await page.getByRole('button', { name: 'Get link', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('img', { name: 'Scan QR Code', exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Copy link', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('http://127.0.0.1:3334/demo')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Copy link: Example location', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('vless://fixture@example.com:443#Example%20location')
    await page.getByRole('button', { name: 'Scan QR Code: Example location', exact: true }).click()
    await expect(page.getByRole('dialog').getByAltText('Example location')).toBeVisible()
})

test('touch card expansion and exact counters do not interfere', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 390, height: 844 }
    })
    const page = await context.newPage()
    await openPage(page)
    await page.getByRole('button', { name: /Exact usage/ }).tap()
    await expect(page.getByText('0 / 26,843,545,600', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show details', exact: true })).toHaveAttribute(
        'aria-expanded',
        'false'
    )
    await page.getByRole('button', { name: 'Show details', exact: true }).tap()
    await expect(page.getByRole('region')).toBeVisible()
    await context.close()
})

test('expiry today and expired dates remain driven by explicit API status', async ({ page }) => {
    await openPage(page, { user: { expiresAt: new Date().toISOString(), daysLeft: 0 } })
    await expect(page.locator('[data-status="ACTIVE"]')).toBeVisible()
    await page.getByRole('button', { name: 'Show details', exact: true }).click()
    await expect(page.getByText('Expiry date')).toBeVisible()
    await openPage(page, {
        user: { userStatus: 'EXPIRED', expiresAt: '2020-01-01T00:00:00.000Z', daysLeft: -1 }
    })
    await expect(page.locator('[data-status="EXPIRED"]')).toBeVisible()
})

test('mobile, tablet, desktop, reduced motion and RTL visual review', async ({
    page
}, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page, { locale: 'ru', user: { trafficUsedBytes: String(20 * 1024 ** 3) } })
    for (const [label, width, height] of [
        ['mobile', 360, 800],
        ['tablet', 768, 1024],
        ['desktop', 1280, 900]
    ] as const) {
        await page.setViewportSize({ width, height })
        await expect(page.locator('[data-usage-color="yellow"]')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true
        )
        await page.screenshot({ path: testInfo.outputPath(`${label}.png`), fullPage: true })
    }
    await page.getByRole('button', { name: 'Change language' }).click()
    await page.getByRole('menuitem', { name: /فارسی/ }).click()
    await expect(page.getByText('بازنشانی ماهانه')).toBeVisible()
    await expect(page.locator('[dir="rtl"]').first()).toBeAttached()
})
