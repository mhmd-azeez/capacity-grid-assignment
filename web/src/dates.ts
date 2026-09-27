import { Temporal } from 'temporal-polyfill'

// Dates travel through the app as "YYYY-MM-DD" strings (URL, API, props).
// Arithmetic goes through Temporal.PlainDate, which has no time and no zone,
// so nothing here can shift a day.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isISODate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  try {
    Temporal.PlainDate.from(s) // throws on 2026-02-30 and friends
    return true
  } catch {
    return false
  }
}

export function addDays(iso: string, days: number): string {
  return Temporal.PlainDate.from(iso).add({ days }).toString()
}

// Monday on or before the date.
export function startOfWeek(iso: string): string {
  const d = Temporal.PlainDate.from(iso)
  return d.subtract({ days: d.dayOfWeek - 1 }).toString() // dayOfWeek: Monday 1 ... Sunday 7
}

// Sunday on or after the date.
export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6)
}

// Whole weeks from the Monday of `from` to the Sunday of `to`.
export function weeksBetween(from: string, to: string): number {
  const start = Temporal.PlainDate.from(startOfWeek(from))
  const end = Temporal.PlainDate.from(endOfWeek(to))
  return (start.until(end).days + 1) / 7
}

// Today in the manager's own time zone. This is the one place local time is
// the right answer: "this week" means their week, not UTC's.
export function today(): string {
  return Temporal.Now.plainDateISO().toString()
}

// "2025-12-29" -> "Dec 29"
export function formatDay(iso: string): string {
  return Temporal.PlainDate.from(iso).toLocaleString(undefined, { month: 'short', day: 'numeric' })
}

// "2025-12-29" -> "Dec 29, 2025"
export function formatDayYear(iso: string): string {
  return Temporal.PlainDate.from(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
