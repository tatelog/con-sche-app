const DAY = 86_400_000

export function calculatePrintRange(projectStart: string, start: string, end: string) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN
  }
  const origin = parse(projectStart)
  const first = parse(start)
  const last = parse(end)
  if (![origin, first, last].every(Number.isFinite) || first > last) return null
  return { start, end, days: (last - first) / DAY + 1, offset: (first - origin) / DAY }
}
