import { useEffect, useRef } from 'react'

// Perlin noise from the supplied wave reference, with typed, effect-local state.
class Noise {
    private p = new Uint8Array(512)
    private gradients = [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
        [1, 0],
        [-1, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [0, 1],
        [0, -1]
    ]

    constructor() {
        const permutation = Uint8Array.from({ length: 256 }, (_, i) => i)
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[permutation[i], permutation[j]] = [permutation[j], permutation[i]]
        }
        for (let i = 0; i < 512; i++) this.p[i] = permutation[i & 255]
    }

    perlin2(x: number, y: number) {
        const X = Math.floor(x) & 255
        const Y = Math.floor(y) & 255
        x -= Math.floor(x)
        y -= Math.floor(y)
        const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
        const dot = (index: number, dx: number, dy: number) => {
            const g = this.gradients[index % 12]
            return g[0] * dx + g[1] * dy
        }
        const lerp = (a: number, b: number, t: number) => a + t * (b - a)
        const p = this.p
        return lerp(
            lerp(dot(p[X + p[Y]], x, y), dot(p[X + 1 + p[Y]], x - 1, y), fade(x)),
            lerp(dot(p[X + p[Y + 1]], x, y - 1), dot(p[X + 1 + p[Y + 1]], x - 1, y - 1), fade(x)),
            fade(y)
        )
    }
}

interface Point {
    x: number
    y: number
    offsetX: number
    offsetY: number
    vx: number
    vy: number
}

export function InteractiveWaves() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return
        const noise = new Noise()
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
        const mobile = window.matchMedia('(pointer: coarse)')
        const mouse = { x: -1000, y: -1000, sx: -1000, sy: -1000, speed: 0, angle: 0 }
        let lines: Point[][] = []
        let width = 0
        let height = 0
        let frame = 0
        let lastTime = 0
        let color = ''

        const draw = (time: number) => {
            ctx.clearRect(0, 0, width, height)
            ctx.beginPath()
            ctx.strokeStyle = color
            ctx.lineWidth = 0.6
            const dx = mouse.x - mouse.sx
            const dy = mouse.y - mouse.sy
            mouse.sx = mouse.x
            mouse.sy = mouse.y
            mouse.speed += (Math.min(100, Math.hypot(dx, dy)) - mouse.speed) * 0.5
            if (dx || dy) mouse.angle = Math.atan2(dy, dx)
            for (const points of lines) {
                let previousX = 0
                let previousY = 0
                for (let i = 0; i < points.length; i++) {
                    const point = points[i]
                    const wave =
                        noise.perlin2(
                            (point.x + time * 0.0125) * 0.002,
                            (point.y + time * 0.005) * 0.0015
                        ) * 12
                    if (!reducedMotion.matches) {
                        const distance = Math.hypot(point.x - mouse.sx, point.y - mouse.sy)
                        const force = Math.max(0, 1 - distance / 175) * mouse.speed * 0.12
                        point.vx =
                            (point.vx - point.offsetX * 0.005 + Math.cos(mouse.angle) * force) *
                            0.925
                        point.vy =
                            (point.vy - point.offsetY * 0.005 + Math.sin(mouse.angle) * force) *
                            0.925
                        point.offsetX = Math.max(-100, Math.min(100, point.offsetX + point.vx * 2))
                        point.offsetY = Math.max(-100, Math.min(100, point.offsetY + point.vy * 2))
                    }
                    const x =
                        point.x + Math.cos(wave) * 32 + (reducedMotion.matches ? 0 : point.offsetX)
                    const y =
                        point.y + Math.sin(wave) * 16 + (reducedMotion.matches ? 0 : point.offsetY)
                    if (i === 0) ctx.moveTo(x, y)
                    else
                        ctx.quadraticCurveTo(
                            previousX,
                            previousY,
                            (previousX + x) / 2,
                            (previousY + y) / 2
                        )
                    previousX = x
                    previousY = y
                }
                ctx.lineTo(previousX, previousY)
            }
            ctx.stroke()
        }
        const tick = (time: number) => {
            const interval = 1000 / (mobile.matches ? 30 : 60)
            const elapsed = time - lastTime
            if (elapsed >= interval - 0.5) {
                draw(time)
                lastTime = time - (Math.max(0, elapsed - interval) % interval)
            }
            frame = requestAnimationFrame(tick)
        }
        const updateAnimation = () => {
            cancelAnimationFrame(frame)
            color = getComputedStyle(canvas).color
            draw(0)
            if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick)
        }
        const resize = () => {
            const bounds = canvas.getBoundingClientRect()
            width = bounds.width
            height = bounds.height
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            lines = []
            for (let x = -100; x <= width + 100; x += 16) {
                const points: Point[] = []
                for (let y = -32; y <= height + 32; y += 32) {
                    points.push({ x, y, offsetX: 0, offsetY: 0, vx: 0, vy: 0 })
                }
                lines.push(points)
            }
            updateAnimation()
        }
        const onPointerMove = (event: PointerEvent) => {
            if (mobile.matches || event.pointerType !== 'mouse') return
            const bounds = canvas.getBoundingClientRect()
            mouse.x = event.clientX - bounds.left
            mouse.y = event.clientY - bounds.top
        }
        const sizeObserver = new ResizeObserver(resize)
        const themeObserver = new MutationObserver(updateAnimation)
        sizeObserver.observe(canvas)
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-mantine-color-scheme']
        })
        window.addEventListener('pointermove', onPointerMove, { passive: true })
        document.addEventListener('visibilitychange', updateAnimation)
        reducedMotion.addEventListener('change', updateAnimation)
        resize()
        return () => {
            cancelAnimationFrame(frame)
            sizeObserver.disconnect()
            themeObserver.disconnect()
            window.removeEventListener('pointermove', onPointerMove)
            document.removeEventListener('visibilitychange', updateAnimation)
            reducedMotion.removeEventListener('change', updateAnimation)
        }
    }, [])

    return <canvas ref={canvasRef} className="animated-background" aria-hidden="true" />
}
