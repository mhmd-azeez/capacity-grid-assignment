import { useCallback, useEffect, useState } from 'react'
import { CapacityGrid, type Range } from './CapacityGrid'
import { endOfWeek, isISODate, startOfWeek } from './dates'

// Where the grid opens when the URL doesn't say otherwise.
const DEFAULT_FROM = '2025-12-29'
const DEFAULT_TO = '2026-01-16'

// The range always covers whole weeks, Monday to Sunday, same as the API.
function wholeWeeks(from: string, to: string): Range {
  return { from: startOfWeek(from), to: endOfWeek(to) }
}

function rangeFromURL(): Range {
  const params = new URLSearchParams(window.location.search)
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  if (isISODate(from) && isISODate(to) && from <= to) {
    return wholeWeeks(from, to)
  }
  return wholeWeeks(DEFAULT_FROM, DEFAULT_TO)
}

export function App() {
  const [range, setRange] = useState(rangeFromURL)

  // Keep the URL in step so a refresh or a shared link opens the same weeks.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('from', range.from)
    url.searchParams.set('to', range.to)
    window.history.replaceState(null, '', url)
  }, [range])

  const onRangeChange = useCallback((next: Range) => setRange(wholeWeeks(next.from, next.to)), [])

  return (
    <main>
      <h1>Team capacity</h1>
      <CapacityGrid from={range.from} to={range.to} onRangeChange={onRangeChange} />
    </main>
  )
}
