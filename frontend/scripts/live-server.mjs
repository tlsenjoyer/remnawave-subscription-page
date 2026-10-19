import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const backend = fileURLToPath(new URL('../../backend/', import.meta.url))
config({ path: new URL('../../.env', import.meta.url), quiet: true })
if (!process.env.REMNAWAVE_PANEL_URL || !process.env.REMNAWAVE_API_TOKEN) {
    throw new Error('Set the panel URL and API token in the root .env first.')
}
await mkdir(`${backend}/dev_frontend`, { recursive: true })
await writeFile(`${backend}/dev_frontend/index.html`, await readFile(`${frontend}/index.html`))
const build = spawn(process.execPath, [`${backend}/node_modules/@rspack/cli/bin/rspack.js`, 'build', '--mode', 'development'], {
    cwd: backend, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'inherit'
})
await new Promise((resolve, reject) => {
    build.on('error', reject)
    build.on('exit', code => code === 0 ? resolve() : reject(new Error('Backend build failed.')))
})
const target = `http://127.0.0.1:${process.env.LOCAL_BACKEND_PORT || 3010}`
const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, NODE_ENV: 'development', APP_PORT: new URL(target).port,
        TRUST_PROXY: 'loopback', INTERNAL_JWT_SECRET: randomBytes(64).toString('hex') },
    stdio: 'inherit'
})
let server
process.once('exit', () => child.kill())
const stop = async () => { child.kill(); await server?.close() }
process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
child.on('error', error => { process.stderr.write(error.message + '\n'); process.exit(1) })
child.on('exit', () => { void server?.close(); process.exitCode = 1 })
try {
    let ready = false
    for (let attempt = 0; attempt < 120; attempt++) {
        if (child.exitCode !== null) throw new Error('Backend stopped during startup.')
        try { ready = (await fetch(`${target}/internal/health`)).ok } catch {}
        if (ready) break
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (!ready) throw new Error('Backend startup timed out.')
    const prefix = process.env.CUSTOM_SUB_PREFIX ? `/${process.env.CUSTOM_SUB_PREFIX}` : ''
    const { createServer } = await import('vite')
    server = await createServer({
        root: frontend,
        server: { host: '127.0.0.1', proxy: {
            [`${prefix}/api/devices`]: { target },
            '/assets/.app-config-v2.json': { target }
        } },
        plugins: [{ name: 'live-remnawave', configureServer(vite) {
            vite.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url, 'http://localhost')
                const subPath = url.pathname.slice(prefix.length)
                if (!url.pathname.startsWith(`${prefix}/`) || !/^\/[^/.]+\/?$/.test(subPath)
                    || !req.headers.accept?.includes('text/html')) return next()
                try {
                    const upstream = await fetch(`${target}${req.url}`, {
                        headers: { 'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
                            accept: 'text/html', cookie: req.headers.cookie || '' },
                        signal: AbortSignal.timeout(30000)
                    })
                    res.statusCode = upstream.status
                    res.setHeader('Cache-Control', 'no-store')
                    res.setHeader('Content-Type', 'text/html; charset=utf-8')
                    const cookies = upstream.headers.getSetCookie()
                    if (cookies.length) res.setHeader('Set-Cookie', cookies)
                    res.end(await vite.transformIndexHtml(req.url, await upstream.text()))
                } catch {
                    res.statusCode = 502
                    res.end('The local backend could not load this subscription. Check its terminal logs.')
                }
            })
        } }]
    })
    await server.listen()
    server.printUrls()
} catch (error) { await stop(); throw error }
