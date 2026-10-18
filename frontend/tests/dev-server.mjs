import { makeSubscription, makeConfig } from './fixtures.mjs'

process.env.PANEL_DATA = Buffer.from(JSON.stringify(makeSubscription())).toString('base64')
process.env.META_TITLE = 'Subscription preview'
process.env.META_DESCRIPTION = 'Synthetic test data'
const { createServer } = await import('vite')
const server = await createServer({
    server: { host: '127.0.0.1' },
    plugins: [{
        name: 'synthetic-panel-config',
        configureServer(vite) {
            vite.middlewares.use('/assets/.app-config-v2.json', (_req, res) => {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(makeConfig()))
            })
        }
    }]
})
await server.listen()
server.printUrls()
