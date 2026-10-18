import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/browser',
    use: { baseURL: 'http://127.0.0.1:3334', browserName: 'chromium', trace: 'retain-on-failure' },
    webServer: {
        command: 'node tests/dev-server.mjs',
        url: 'http://127.0.0.1:3334',
        reuseExistingServer: !process.env.CI
    },
    workers: 2,
    reporter: 'list'
})
