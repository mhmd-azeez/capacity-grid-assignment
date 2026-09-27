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

function pageFromURL(): number {
  const page = Number(new URLSearchParams(window.location.search).get('page'))
  return Number.isInteger(page) && page >= 1 ? page : 1
}

function nameFromURL(): string {
  return new URLSearchParams(window.location.search).get('q') ?? ''
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
  const [page, setPage] = useState(pageFromURL)
  const [name, setName] = useState(nameFromURL)

  // Keep the URL in step so a refresh or a shared link opens the same view.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('from', range.from)
    url.searchParams.set('to', range.to)
    url.searchParams.set('page', String(page))
    if (name) url.searchParams.set('q', name)
    else url.searchParams.delete('q')
    window.history.replaceState(null, '', url)
  }, [range, page, name])

  const onRangeChange = useCallback((next: Range) => setRange(wholeWeeks(next.from, next.to)), [])

  // A new search starts from the first page of its results.
  const onNameChange = useCallback((next: string) => {
    setName(next)
    setPage(1)
  }, [])

  return (
    <main>
      <h1>Team capacity</h1>
      <CapacityGrid
        from={range.from}
        to={range.to}
        page={page}
        name={name}
        onRangeChange={onRangeChange}
        onPageChange={setPage}
        onNameChange={onNameChange}
      />
    </main>
  )
}
