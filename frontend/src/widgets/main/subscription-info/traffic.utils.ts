export type TrafficCounters = { trafficUsedBytes: string; trafficLimitBytes: string }

const readBytes = (value: string): bigint | null => (/^\d+$/.test(value) ? BigInt(value) : null)

export function getTrafficMetrics(user: TrafficCounters) {
    const used = readBytes(user.trafficUsedBytes)
    const limit = readBytes(user.trafficLimitBytes)
    const unlimited = limit === 0n
    const valid = used !== null && limit !== null
    const percentage = valid && !unlimited ? Number((used * 10000n) / limit) / 100 : null
    const color =
        valid && !unlimited
            ? used >= limit
                ? 'red'
                : used * 100n >= limit * 80n
                  ? 'yellow'
                  : 'green'
            : 'gray'
    return {
        used,
        limit,
        unlimited,
        percentage,
        color,
        progress: Math.min(100, Math.max(0, percentage ?? 0))
    }
}

// Match Remnawave quota sizes (powers of 1024), with familiar localized unit labels.
export function formatTrafficBytes(bytes: bigint | null, locale: string): string {
    if (bytes === null) return '—'
    if (bytes === 0n) return locale === 'ru' ? '0\u00a0МБ' : '0\u00a0MB'
    const units =
        locale === 'ru'
            ? ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ', 'ЭБ']
            : ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
    let unit = 0
    let divisor = 1n
    while (bytes >= divisor * 1024n && unit < units.length - 1) {
        divisor *= 1024n
        unit++
    }
    const value = Number((bytes * 100n) / divisor) / 100
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}\u00a0${units[unit]}`
}

export function formatExactBytes(bytes: bigint | null, locale: string): string {
    return bytes === null ? '—' : new Intl.NumberFormat(locale).format(bytes)
}
