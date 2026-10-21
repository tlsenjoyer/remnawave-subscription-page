import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { makeConfig, makeSubscription } from '../fixtures.mjs'

async function openPage(page: Page, { config = makeConfig(), user = {}, locale = 'en' } = {}) {
    await page.addInitScript((lang) => localStorage.setItem('i18nextLng', lang), locale)
    await page.route('**/assets/.app-config-v2.json?*', (route) => route.fulfill({ json: config }))
    await page.route('**/demo', async (route) => {
        const response = await route.fetch({ url: new URL('/', route.request().url()).href })
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
    await page.getByRole('button', { name: 'Connect a device', exact: true }).click()
    return page.getByRole('dialog', { name: 'Connection setup', exact: true })
}

test('traffic remains accessible and username is absent', async ({ page }) => {
    await openPage(page)
    await expect(page.getByRole('progressbar', { name: /^LTE/ })).toHaveAttribute(
        'aria-valuenow',
        '0'
    )
    await expect(page.getByText('never-display-this-username')).toHaveCount(0)
    await expect(page.getByText('Expiry date 8 April 2027', { exact: true })).toBeVisible()
    await expect(page.getByText('Active', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Show details', exact: true })).toHaveCount(0)
    await expect(page.getByText('Resets on day 18 of every month')).toBeVisible()
    await page.getByRole('button', { name: /Exact usage \(MB\)/ }).focus()
    await expect(page.getByText('0 / 25,600', { exact: true })).toBeVisible()
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
        await expect(dialog.getByRole('button', { name: 'Continue' })).toBeVisible()
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
                page.getByRole('button', { name: 'Show QR code', exact: true })
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
                await page.getByRole('menuitem', { name: app, exact: true }).click()
                await expect(dialog.getByRole('heading', { name: app, exact: true })).toBeVisible()
                await expect(page.getByRole('menu')).toHaveCount(0)
            }
        }
        await dialog.getByRole('button', { name: 'Continue' }).click()
        await expect(
            dialog.getByRole('heading', { name: 'Add your subscription', exact: true })
        ).toBeFocused()
        await expect(dialog.getByRole('heading', { name: 'Enable VPN', exact: true })).toBeVisible()
        await dialog.getByRole('button', { name: 'Back', exact: true }).click()
        await expect(dialog.getByRole('heading', { name: apps.at(-1), exact: true })).toBeVisible()
    })
test('main page copy and QR, completion, nested support and reopen', async ({ page }, info) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await openPage(page)
    const link = page.getByRole('textbox', { name: 'Copy subscription link', exact: true })
    await expect(link).toHaveValue(page.url())
    await page.getByRole('button', { name: 'Copy subscription link', exact: true }).click()
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe(await link.inputValue())
    const qrTrigger = page.getByRole('button', { name: 'Show QR code', exact: true })
    await qrTrigger.click()
    const qr = page.getByRole('dialog', { name: 'Show QR code', exact: true })
    await expect(qr.getByRole('img', { name: /Scan in your VPN app/ })).toBeVisible()
    await qr
        .getByRole('img', { name: /Scan in your VPN app/ })
        .screenshot({ path: info.outputPath('qr.png') })
    await page.keyboard.press('Escape')
    await expect(qrTrigger).toBeFocused()
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Android', exact: true }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('link', { name: 'Add to incy', exact: true })).toHaveAttribute(
        'href',
        `incy://import/${page.url()}`
    )
    await expect(
        dialog.getByRole('button', { name: 'Copy subscription link', exact: true })
    ).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: /Show QR code/ })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Advanced connection options' })).toHaveCount(0)
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
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(dialog.getByRole('heading', { name: 'Setup complete' })).toBeVisible()
    await expect(dialog.getByText('Open incy and enable the VPN.', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'support@tovarish.net' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Support', exact: true }).click()
    await expect(support.getByRole('link', { name: 'support@tovarish.net' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.screenshot({ path: info.outputPath('completion.png'), fullPage: true })
    await dialog.getByRole('button', { name: 'Return to subscription', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Connect a device', exact: true })).toBeFocused()
    const reopened = await wizard(page)
    await expect(reopened.getByRole('heading', { name: 'Install the app' })).toBeVisible()
    await expect(reopened.getByRole('button', { name: 'Android', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
    )
})
test('query imports encode the complete subscription URL', async ({ page }) => {
    await openPage(page)
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Linux', exact: true }).click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('link', { name: 'Add to Koala Clash' })).toHaveAttribute(
        'href',
        `koala-clash://install-config?url=${encodeURIComponent(page.url())}`
    )
})
for (const locale of ['en', 'ru'])
    test(`download labels come entirely from the panel in ${locale}`, async ({ page }) => {
        const config = makeConfig()
        const buttons = config.platforms.android.apps[0].blocks[0].buttons
        for (const [index, button] of buttons.entries()) {
            button.text.en = `Get the client — route ${index + 1}`
            button.text.ru = `Получить приложение — способ ${index + 1}`
        }
        await openPage(page, { config, locale })
        await page
            .getByRole('button', {
                name: locale === 'ru' ? 'Подключить устройство' : 'Connect a device',
                exact: true
            })
            .click()
        const dialog = page.getByRole('dialog')
        await dialog.getByRole('button', { name: 'Android', exact: true }).click()
        for (const button of buttons) {
            const link = dialog.getByRole('link', { name: button.text[locale], exact: true })
            await expect(link).toHaveAttribute('href', button.link)
            await expect(link.locator('svg')).toHaveCount(1)
        }
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
                                      id: 'test-phone-hwid',
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
        await page.getByRole('button', { name: 'Your devices', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Your devices', exact: true })
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
    await expect(page.getByText('Сброс 18 числа ежемесячно')).toBeVisible()
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
            .getByRole('button', { name: 'Подключить устройство', exact: true })
            .boundingBox()
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true
        )
        await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true })
    }
    await page.getByRole('button', { name: 'Подключить устройство', exact: true }).click()
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
test('touch traffic tooltip, QR popup and wizard', async ({ browser }) => {
    const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 390, height: 844 }
    })
    const page = await context.newPage()
    await openPage(page)
    await page.getByRole('button', { name: /Exact usage/ }).tap()
    await expect(page.getByText('0 / 25,600', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Show QR code', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'Show QR code', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Connect a device', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'Connection setup' })).toBeVisible()
    await context.close()
})

test('Russian mobile setup actions wrap without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await openPage(page, { locale: 'ru' })
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
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Подключить устройство', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Настройка подключения', exact: true })
    await expect(dialog.getByRole('button', { name: 'Назад', exact: true })).toBeDisabled()
    const footer = dialog.locator('footer')
    const next = dialog.getByRole('button', { name: 'Продолжить', exact: true })
    const initialFooter = (await footer.boundingBox())!
    const initialNext = (await next.boundingBox())!
    expect(initialFooter.y).toBeGreaterThan(initialNext.y + initialNext.height)
    expect(initialFooter.y + initialFooter.height).toBeGreaterThanOrEqual(640)
    await footer.scrollIntoViewIfNeeded()
    const footerBounds = (await footer.boundingBox())!
    expect(footerBounds.y + footerBounds.height).toBeCloseTo(640, 0)
    expect(footerBounds.y).toBeLessThan(initialFooter.y)
    const nextBounds = (await next.boundingBox())!
    expect(nextBounds.y + nextBounds.height).toBeLessThanOrEqual(footerBounds.y)
    await next.click()
    await next.click()
    await expect(
        dialog.getByRole('button', { name: 'Вернуться к подписке', exact: true })
    ).toBeVisible()
    await expect(
        page.getByRole('heading', { name: 'Настройка завершена', exact: true })
    ).toBeVisible()
})

test('appearance follows the device until a saved override is chosen', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await openPage(page)
    const root = page.locator('html')
    const appearance = page.getByRole('button', { name: 'Dark appearance', exact: true })
    await expect(root).toHaveAttribute('data-mantine-color-scheme', 'dark')
    await expect(appearance).toHaveAttribute('aria-pressed', 'true')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(root).toHaveAttribute('data-mantine-color-scheme', 'light')
    await appearance.click()
    await expect(root).toHaveAttribute('data-mantine-color-scheme', 'dark')
    await page.reload()
    await expect(root).toHaveAttribute('data-mantine-color-scheme', 'dark')
    await page.getByRole('button', { name: 'Show QR code', exact: true }).click()
    await expect(
        page.getByRole('dialog').getByRole('img', { name: /Scan in your VPN app/ })
    ).toBeVisible()
    await page.keyboard.press('Escape')
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(dialog.getByRole('button', { name: 'Advanced connection options' })).toHaveCount(0)
})

for (const mobile of [false, true])
    test.describe(`waves on ${mobile ? 'mobile' : 'desktop'}`, () => {
        test.use({ hasTouch: mobile, viewport: { width: mobile ? 390 : 1280, height: 844 } })

        test('frame cap and pointer input', async ({ page }) => {
            await page.emulateMedia({ reducedMotion: 'no-preference' })
            await page.addInitScript(() => {
                const request = window.requestAnimationFrame.bind(window)
                window.requestAnimationFrame = (callback) => {
                    if (callback.name !== 'tick') return request(callback)
                    Reflect.set(window, 'waveTick', callback)
                    return 0
                }
            })
            await openPage(page)
            const result = await page.evaluate(() => {
                let points: number[][] = []
                const curve = CanvasRenderingContext2D.prototype.quadraticCurveTo
                CanvasRenderingContext2D.prototype.quadraticCurveTo = function (x, y, endX, endY) {
                    if (this.canvas.classList.contains('animated-background')) points.push([x, y])
                    return curve.call(this, x, y, endX, endY)
                }
                let time = performance.now()
                const step = (elapsed = 40) => {
                    points = []
                    time += elapsed
                    Reflect.get(window, 'waveTick')(time)
                    return points
                }
                const move = (x: number, y: number, pointerType: string) =>
                    window.dispatchEvent(
                        new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType })
                    )
                const displacement = (before: number[][], after: number[][]) =>
                    Math.max(
                        ...before.map(([x, y], i) =>
                            Math.hypot(x - 100, y - 100) < 80
                                ? Math.hypot(after[i][0] - x, after[i][1] - y)
                                : 0
                        )
                    )
                try {
                    step()
                    let frames = 0
                    for (let i = 0; i < 120; i++) {
                        if (step(1000 / 120).length) frames++
                    }
                    move(1100, 700, 'mouse')
                    for (let i = 0; i < 80; i++) step()
                    const beforeTouch = step()
                    move(100, 100, 'touch')
                    const touchDisplacement = displacement(beforeTouch, step())
                    const beforeMouse = step()
                    move(100, 100, 'mouse')
                    return {
                        frames,
                        touchDisplacement,
                        mouseDisplacement: displacement(beforeMouse, step())
                    }
                } finally {
                    CanvasRenderingContext2D.prototype.quadraticCurveTo = curve
                }
            })
            expect(result.frames).toBeGreaterThanOrEqual((mobile ? 30 : 60) - 1)
            expect(result.frames).toBeLessThanOrEqual((mobile ? 30 : 60) + 1)
            expect(result.touchDisplacement).toBeLessThan(1)
            if (mobile) expect(result.mouseDisplacement).toBeLessThan(1)
            else expect(result.mouseDisplacement).toBeGreaterThan(3)
        })
    })

test('waves resize, respect reduced motion, and pause in a hidden tab', async ({ page }) => {
    await page.addInitScript(() => {
        Reflect.set(window, 'waveDraws', 0)
        const clear = CanvasRenderingContext2D.prototype.clearRect
        CanvasRenderingContext2D.prototype.clearRect = function (x, y, width, height) {
            if (this.canvas.classList.contains('animated-background')) {
                Reflect.set(window, 'waveDraws', Reflect.get(window, 'waveDraws') + 1)
            }
            return clear.call(this, x, y, width, height)
        }
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page)
    const canvas = page.locator('canvas.animated-background')
    await expect(canvas).toHaveAttribute('aria-hidden', 'true')
    const draws = () => page.evaluate(() => Reflect.get(window, 'waveDraws') as number)
    await expect.poll(draws).toBeGreaterThan(0)
    const staticCount = await draws()
    await page.mouse.move(100, 100)
    await page.waitForTimeout(150)
    expect(await draws()).toBe(staticCount)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(() => canvas.evaluate((el) => el.width)).toBe(390)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const start = await draws()
    await expect.poll(draws).toBeGreaterThan(start + 2)
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true })
        document.dispatchEvent(new Event('visibilitychange'))
    })
    const paused = await draws()
    await page.waitForTimeout(150)
    expect(await draws()).toBe(paused)
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false })
        document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(draws).toBeGreaterThan(paused + 2)
})

test('Russian finite expiry sits under the plan name', async ({ page }) => {
    await openPage(page, { locale: 'ru', user: { expiresAt: '2100-01-01T00:00:00Z' } })
    await expect(page.getByText('Действует до 1 января 2100', { exact: true })).toBeVisible()
    await expect(page.getByText('Активна', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Подробнее', exact: true })).toHaveCount(0)
})

for (const width of [390, 768, 1280])
    test(`compact subscription card and connection spacing at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 })
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await openPage(page)
        const qr = page.getByRole('button', { name: 'Show QR code', exact: true })
        const qrBox = await qr.boundingBox()
        const linkBox = await page
            .getByRole('textbox', { name: 'Copy subscription link', exact: true })
            .locator('..')
            .locator('..')
            .boundingBox()
        const card = page.locator('main .mantine-Card-root').last()
        const cardBox = await card.boundingBox()
        expect(qrBox!.width).toBeCloseTo(linkBox!.width, 0)
        expect(cardBox!.y + cardBox!.height - qrBox!.y - qrBox!.height).toBeLessThanOrEqual(33)
        await expect(card.getByRole('region', { includeHidden: true })).toHaveCount(0)
        const intro = await page
            .getByText(
                'Choose your device. Install an app. Add your subscription. We’ll guide you through it.',
                { exact: true }
            )
            .boundingBox()
        const connect = await page
            .getByRole('button', { name: 'Connect a device', exact: true })
            .boundingBox()
        const gap = connect!.y - intro!.y - intro!.height
        expect(gap).toBeGreaterThanOrEqual(28)
        if (width === 390) expect(gap).toBeLessThanOrEqual(32)
        if (width >= 768) {
            expect(connect!.y).toBeCloseTo(qrBox!.y, 0)
            expect(connect!.height).toBeCloseTo(qrBox!.height, 0)
            const connectionBox = await page
                .locator('main .mantine-Card-root')
                .first()
                .boundingBox()
            expect(connectionBox!.y).toBeCloseTo(cardBox!.y, 0)
            expect(connectionBox!.height).toBeCloseTo(cardBox!.height, 0)
        }
        if (width === 1280) {
            const title = page.getByRole('heading', { name: 'Connect your VPN', exact: true })
            const size = await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
            expect(size).toBeGreaterThanOrEqual(40)
            expect(size).toBeLessThanOrEqual(48)
        }
    })

test('panel icons render on external, import and copy buttons; steps lead the wizard', async ({
    page
}) => {
    const config = makeConfig()
    const install = config.platforms.android.apps[0].blocks[0]
    install.buttons.push({
        ...install.buttons[0],
        type: 'copyButton',
        link: 'copy-this',
        text: { ...install.buttons[0].text, en: 'Panel copy' }
    })
    await openPage(page, { config })
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Android', exact: true }).click()
    for (const button of install.buttons) {
        const action = dialog.getByRole(button.type === 'copyButton' ? 'button' : 'link', {
            name: button.text.en,
            exact: true
        })
        await expect(action.locator('svg')).toHaveCount(1)
    }
    const steps = await dialog.getByRole('list').boundingBox()
    const heading = await dialog
        .getByRole('heading', { name: 'Install the app', exact: true })
        .boundingBox()
    const support = await dialog.getByRole('button', { name: 'Support', exact: true }).boundingBox()
    expect(steps!.y).toBeLessThan(heading!.y)
    expect(support!.y).toBeGreaterThan(heading!.y)
    const choose = dialog.getByRole('button', { name: 'Choose another app', exact: true })
    await choose.click()
    await expect(choose).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('menu', { name: 'Choose another app' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(choose).toBeFocused()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await expect(
        dialog.getByRole('link', { name: 'Add to incy', exact: true }).locator('svg')
    ).toHaveCount(1)
})

for (const width of [390, 1280])
    test(`device refresh retains modal bounds at ${width}px, including error retries`, async ({
        page
    }, info) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
        await openPage(page)
        let pending: Promise<void> | undefined
        let release = () => {}
        let status = 200
        await page.route('**/api/devices', async (route) => {
            if (pending) await pending
            await route.fulfill({
                status,
                json: {
                    total: 1,
                    limit: 5,
                    devices: [
                        {
                            id: 'test-phone-hwid',
                            deviceModel: 'Test phone',
                            platform: 'Android',
                            osVersion: '16',
                            createdAt: '2026-01-01T00:00:00Z',
                            updatedAt: '2026-10-01T00:00:00Z'
                        }
                    ]
                }
            })
        })
        await page.getByRole('button', { name: 'Your devices', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Your devices', exact: true })
        await expect(dialog.getByText('Test phone')).toBeVisible()
        const refresh = dialog.getByRole('button', { name: 'Try again', exact: true })
        await expect(dialog).toHaveCSS('opacity', '1')
        let previousStatus = 200
        for (const nextStatus of [200, 503, 200]) {
            await refresh.click({ trial: true })
            const before = await dialog.boundingBox()
            pending = new Promise<void>((resolve) => {
                release = resolve
            })
            status = nextStatus
            await refresh.click()
            await expect(refresh).toBeDisabled()
            await expect(dialog.locator('div[aria-busy="true"]')).toBeVisible()
            expect(await dialog.boundingBox()).toEqual(before)
            await expect(dialog.getByText('Test phone')).toHaveCount(previousStatus === 200 ? 1 : 0)
            await expect(dialog.getByRole('status')).toHaveCount(0)
            if (nextStatus === 200 && previousStatus === 200)
                await page.screenshot({ path: info.outputPath('refresh-pending.png') })
            release()
            await expect(refresh).toBeEnabled()
            await expect(dialog.locator('div[aria-busy="false"]')).toBeVisible()
            if (nextStatus === 503) await expect(dialog.getByText(/We couldn’t load/)).toBeVisible()
            else {
                await expect(dialog.getByText('Test phone')).toBeVisible()
                await expect(dialog.getByText(/We couldn’t load/)).toHaveCount(0)
            }
            previousStatus = nextStatus
        }
    })

for (const width of [390, 1280])
    for (const theme of ['light', 'dark'] as const)
        test(`wizard shared frame at ${width}px in ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 })
            await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
            await openPage(page)
            await page.getByRole('button', { name: /Exact usage \(MB\)/ }).hover()
            await expect(page.getByText('0 / 25,600', { exact: true })).toBeVisible()
            await page.screenshot({ path: info.outputPath('summary.png'), fullPage: true })
            await page.mouse.move(0, 0)
            const buttonText = await page
                .getByRole('button', { name: 'Connect a device', exact: true })
                .evaluate((el) => {
                    const style = getComputedStyle(el)
                    return { size: style.fontSize, weight: style.fontWeight }
                })
            const dialog = await wizard(page)
            await dialog.getByRole('button', { name: 'Windows', exact: true }).click()
            const download = dialog.getByRole('link', {
                name: makeConfig().platforms.windows.apps[0].blocks[0].buttons[0].text.en,
                exact: true
            })
            const before = await download.boundingBox()
            const choose = dialog.getByRole('button', { name: 'Choose another app' })
            const client = dialog.getByRole('heading', { name: 'Koala Clash', exact: true })
            const badge = dialog.getByText('Recommended', { exact: true })
            const centerY = async (locator: typeof choose) => {
                const box = (await locator.boundingBox())!
                return box.y + box.height / 2
            }
            expect(Math.abs((await centerY(client)) - (await centerY(choose)))).toBeLessThan(1)
            expect(Math.abs((await centerY(badge)) - (await centerY(choose)))).toBeLessThan(1)
            await expect(dialog.getByText('Windows', { exact: true })).toHaveCount(1)
            await choose.click()
            for (const option of await page.getByRole('menuitem').all()) {
                await expect(option).toHaveCSS('font-size', buttonText.size)
                await expect(option).toHaveCSS('font-weight', buttonText.weight)
            }
            expect(await download.boundingBox()).toEqual(before)
            await page.keyboard.press('Escape')
            await expect(choose).toBeFocused()
            let frame:
                | {
                      x: number
                      y: number
                      width: number
                      padding: string
                      border: string
                      radius: string
                      fontSize: string
                      headingX: number
                      headingY: number
                  }
                | undefined
            for (const [step, title, next] of [
                [0, 'Install the app', 'Continue'],
                [1, 'Add your subscription', 'Continue'],
                [2, 'Setup complete', 'Return to subscription']
            ] as const) {
                const heading = dialog.getByRole('heading', { name: title, exact: true })
                await expect(heading).toBeVisible()
                if (step > 0) await expect(heading).toBeFocused()
                for (const button of await dialog
                    .locator('button, a')
                    .filter({ hasText: /\S/ })
                    .all()) {
                    await expect(button).toHaveCSS('font-size', buttonText.size)
                    await expect(button).toHaveCSS('font-weight', buttonText.weight)
                }
                const panel = dialog
                    .locator('section')
                    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
                    .first()
                const metrics = () =>
                    panel.evaluate((el) => {
                        const box = el.getBoundingClientRect()
                        const style = getComputedStyle(el)
                        const heading = el.querySelector('h2')!
                        const title = heading.getBoundingClientRect()
                        return {
                            x: box.x,
                            y: box.y,
                            width: box.width,
                            padding: style.padding,
                            border: style.border,
                            radius: style.borderRadius,
                            fontSize: getComputedStyle(heading).fontSize,
                            headingX: title.x,
                            headingY: title.y
                        }
                    })
                if (frame) await expect.poll(metrics).toEqual(frame)
                else frame = await metrics()
                const bottomGap = await panel.evaluate((el) => {
                    const content = el.querySelector('section:last-child > :last-child') || el.firstElementChild!.lastElementChild!
                    return el.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom
                })
                expect(bottomGap).toBe(width === 390 ? 25 : 33)
                const header = dialog.locator('header')
                const headerBounds = (await header.boundingBox())!
                const modalTitle = header.getByRole('heading', { name: 'Connection setup' })
                const titleBounds = (await modalTitle.boundingBox())!
                const close = header.getByRole('button', { name: 'Close', exact: true })
                const closeBounds = (await close.boundingBox())!
                const stepsBounds = (await dialog.getByRole('list').boundingBox())!
                expect(titleBounds.x).toBe(frame.x)
                expect(stepsBounds.x).toBe(frame.x)
                expect(closeBounds.x + closeBounds.width).toBe(frame.x + frame.width)
                expect(closeBounds.width).toBe(40)
                expect(closeBounds.height).toBe(40)
                await expect(close.locator('svg')).toHaveCSS('width', '20px')
                await expect(close.locator('svg')).toHaveCSS('height', '20px')
                await expect(modalTitle).toHaveCSS('font-size', '16px')
                await expect(modalTitle).toHaveCSS('font-weight', '500')
                await expect(header).toHaveCSS('border-bottom-width', '0px')
                const headerGap = stepsBounds.y - headerBounds.y - headerBounds.height
                expect(headerGap).toBeGreaterThanOrEqual(24)
                expect(headerGap).toBeLessThanOrEqual(32)
                const panelGap = frame.y - stepsBounds.y - stepsBounds.height
                expect(panelGap).toBeGreaterThanOrEqual(28)
                expect(panelGap).toBeLessThanOrEqual(32)
                await expect(
                    dialog.getByRole('button', { name: 'Support', exact: true })
                ).toHaveCount(1)
                const back = dialog.getByRole('button', { name: 'Back', exact: true })
                await expect(back).toBeVisible()
                if (step === 0) await expect(back).toBeDisabled()
                else await expect(back).toBeEnabled()
                const navigation = dialog.getByRole('navigation')
                const nextButton = navigation.getByRole('button', { name: next, exact: true })
                await expect(nextButton).toHaveAttribute('data-variant', 'default')
                const footer = dialog.locator('footer')
                const footerBounds = (await footer.boundingBox())!
                expect(footerBounds.y + footerBounds.height).toBeGreaterThanOrEqual(1000)
                const initialNext = (await nextButton.boundingBox())!
                expect(footerBounds.y).toBeGreaterThan(initialNext.y + initialNext.height)
                if (step === 0)
                    await page.screenshot({
                        path: info.outputPath('step-0-top.png'),
                        fullPage: true
                    })
                await nextButton.evaluate((el) => el.scrollIntoView({ block: 'center' }))
                await footer.scrollIntoViewIfNeeded()
                const scrolledFooter = (await footer.boundingBox())!
                expect(scrolledFooter.y + scrolledFooter.height).toBeCloseTo(1000, 0)
                const nextBounds = (await nextButton.boundingBox())!
                expect(nextBounds.y + nextBounds.height).toBeLessThanOrEqual(scrolledFooter.y)
                if (step === 1)
                    await expect(
                        dialog.getByText('Windows · Koala Clash', { exact: true })
                    ).toBeVisible()
                expect(
                    await panel.evaluate(
                        (el) => getComputedStyle(el.firstElementChild!).animationName
                    )
                ).toBe('none')
                expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
                await page.mouse.move(0, 0)
                await page.screenshot({ path: info.outputPath(`step-${step}.png`), fullPage: true })
                await nextButton.click()
            }
            await expect(
                page.getByRole('button', { name: 'Connect a device', exact: true })
            ).toBeFocused()
            const reopened = await wizard(page)
            await reopened.getByRole('button', { name: 'Close', exact: true }).click()
            await expect(reopened).not.toBeVisible()
            await expect(
                page.getByRole('button', { name: 'Connect a device', exact: true })
            ).toBeFocused()
        })

test('import has no manual fallback disclosure', async ({ page }) => {
    await openPage(page)
    const dialog = await wizard(page)
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(dialog.locator('details')).toHaveCount(0)
    await expect(
        dialog.getByRole('textbox', { name: 'Copy subscription link', exact: true })
    ).toHaveCount(0)
})

for (const theme of ['light', 'dark'] as const)
    for (const width of [390, 1280])
        test(`device deletion ${theme} ${width}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 })
            await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
            await openPage(page, { locale: 'ru' })
            const device = {
                id: 'windows-pc-hwid',
                deviceModel: 'Windows 11 PC',
                platform: 'Windows',
                osVersion: '11',
                createdAt: '2026-10-01T12:00:00.000Z',
                updatedAt: '2026-10-18T12:00:00.000Z'
            }
            let deletes = 0
            let release = () => {}
            await page.route('**/api/devices', async (route) => {
                if (route.request().method() === 'DELETE') {
                    deletes++
                    expect(route.request().headers()['x-subscription-id']).toBe('demo')
                    expect(route.request().postDataJSON()).toEqual({ id: device.id })
                    await new Promise<void>((resolve) => {
                        release = resolve
                    })
                    await route.fulfill({ json: { total: 0, limit: 5, devices: [] } })
                } else await route.fulfill({ json: { total: 1, limit: 5, devices: [device] } })
            })
            page.on('dialog', () => {
                throw new Error('Deletion must not open a confirmation dialog')
            })
            await page.getByRole('button', { name: 'Ваши устройства', exact: true }).click()
            const dialog = page.getByRole('dialog', { name: 'Ваши устройства', exact: true })
            const remove = dialog.getByRole('button', { name: 'Удалить', exact: true })
            await expect(remove).toBeVisible()
            await expect(remove).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
            await expect(remove).toHaveCSS('border-style', 'none')
            await expect(remove).toHaveCSS('text-decoration-line', 'none')
            await remove.hover()
            await expect(remove).toHaveCSS('text-decoration-line', 'underline')
            const bounds = await remove.boundingBox()
            expect(bounds!.width).toBeGreaterThan(24)
            expect(bounds!.height).toBeGreaterThanOrEqual(44)
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
            await page.screenshot({ path: info.outputPath('devices.png'), fullPage: true })
            await remove.focus()
            await page.keyboard.press('Enter')
            await expect.poll(() => deletes).toBe(1)
            const deleting = dialog.getByRole('button', { name: 'Удаление...', exact: true })
            await expect(deleting).toBeDisabled()
            await expect(deleting).toHaveAttribute('aria-busy', 'true')
            await expect(dialog.getByText('Windows 11 PC', { exact: true })).toBeVisible()
            await expect(
                dialog.getByRole('button', { name: 'Обновить', exact: true })
            ).toBeDisabled()
            await page.screenshot({ path: info.outputPath('deleting.png'), fullPage: true })
            release()
            await expect(dialog.getByText('Зарегистрированных устройств пока нет')).toBeVisible()
            await expect(dialog.getByRole('heading', { name: '0 / 5', exact: true })).toBeVisible()
            await expect(remove).toHaveCount(0)
            await expect(
                dialog.getByRole('button', { name: 'Обновить', exact: true })
            ).toBeFocused()
            expect(deletes).toBe(1)
            await page.keyboard.press('Escape')
            await expect(page.getByRole('button', { name: /^Ваши устройства/ })).toBeFocused()
        })

for (const [locale, width, devicesLabel, deleteLabel, pendingLabel, retryLabel] of [
    ['en', 1280, 'Your devices', 'Delete', 'Deleting...', 'Try again'],
    ['ru', 390, 'Ваши устройства', 'Удалить', 'Удаление...', 'Обновить']
] as const)
    test(`device deletion preserves scroll position in ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await openPage(page, { locale })
        const devices = Array.from({ length: 20 }, (_, index) => ({
            id: `device-${index}`,
            deviceModel: `Phone ${index}`,
            platform: 'Android',
            osVersion: '16',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z'
        }))
        let release = () => {}
        await page.route('**/api/devices', async (route) => {
            let remaining = devices
            if (route.request().method() === 'DELETE') {
                const { id } = route.request().postDataJSON()
                await new Promise<void>((resolve) => {
                    release = resolve
                })
                remaining = devices.filter((device) => device.id !== id)
            }
            await route.fulfill({
                json: { total: remaining.length, limit: 25, devices: remaining }
            })
        })
        await page.getByRole('button', { name: devicesLabel, exact: true }).click()
        const dialog = page.getByRole('dialog', { name: devicesLabel, exact: true })
        await dialog.getByRole('button', { name: deleteLabel, exact: true }).nth(6).click()
        await expect(dialog.getByRole('button', { name: pendingLabel, exact: true })).toBeDisabled()
        const before = await dialog.evaluate((el) => el.scrollTop)
        expect(before).toBeGreaterThan(0)
        expect(
            await dialog.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)
        ).toBeGreaterThan(1000)
        release()
        await expect(dialog.getByText('Phone 6', { exact: true })).toHaveCount(0)
        await expect(dialog.getByRole('button', { name: retryLabel, exact: true })).toBeFocused()
        expect(await dialog.evaluate((el) => el.scrollTop)).toBeCloseTo(before, 0)
        await expect(dialog.getByRole('button', { name: pendingLabel, exact: true })).toHaveCount(0)
    })

for (const failure of ['permission', 'expired', 'network'])
    test(`device deletion failure ${failure} preserves the device`, async ({ page }) => {
        await openPage(page)
        let failed = true
        await page.route('**/api/devices', async (route) => {
            if (route.request().method() === 'DELETE') {
                if (failure === 'network' && failed) return route.abort()
                return route.fulfill({
                    status: failed ? (failure === 'expired' ? 401 : 503) : 200,
                    json: { total: 0, limit: 5, devices: [] }
                })
            }
            return route.fulfill({
                json: {
                    total: 1,
                    limit: 5,
                    devices: [
                        {
                            id: 'phone',
                            deviceModel: 'Test phone',
                            platform: 'Android',
                            osVersion: '16',
                            createdAt: '2026-01-01T00:00:00Z',
                            updatedAt: '2026-10-01T00:00:00Z'
                        }
                    ]
                }
            })
        })
        await page.getByRole('button', { name: 'Your devices', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Your devices', exact: true })
        const remove = dialog.getByRole('button', { name: 'Delete', exact: true })
        await remove.click()
        await expect(dialog.getByText('Test phone')).toBeVisible()
        await expect(dialog.getByRole('heading', { name: '1 / 5', exact: true })).toBeVisible()
        if (failure === 'expired') {
            await expect(dialog.getByRole('button', { name: 'Reload page' })).toBeVisible()
            await expect(remove).toBeDisabled()
        } else {
            await expect(dialog.getByText(/We couldn’t delete this device/)).toBeVisible()
            await expect(remove).toBeEnabled()
            failed = false
            await remove.click()
            await expect(dialog.getByText('No registered devices yet')).toBeVisible()
        }
    })
