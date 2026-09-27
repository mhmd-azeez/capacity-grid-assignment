import { useEffect, useState } from 'react'
import { fetchCapacity, type CapacityResponse } from './api'
import { hoursOver } from './capacity'

type Props = {
  from: string
  to: string
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CapacityResponse }

// CapacityGrid renders one row per person and one column per week, showing
// how allocated each person is against their weekly hours.
export function CapacityGrid({ from, to }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    // Abort the in-flight request when the range changes or the grid
    // unmounts, so a slow old response can't overwrite a newer one.
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetchCapacity(from, to, controller.signal).then(
      (data) => setState({ status: 'ready', data }),
      (err: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      },
    )
    return () => controller.abort()
  }, [from, to])

  if (state.status === 'loading') {
    return <p>Loading capacity…</p>
  }
  if (state.status === 'error') {
    return <p role="alert">Couldn't load capacity: {state.message}</p>
  }

  const { weeks, people } = state.data
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Person</th>
          {weeks.map((week) => (
            <th scope="col" key={week}>
              {formatWeek(week)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {people.map((person) => (
          <tr key={person.id}>
            <th scope="row">{person.name}</th>
            {person.allocated.map((hours, i) => {
              const over = hoursOver(hours, person.weekly_hours)
              return (
                <td key={weeks[i]} className={over > 0 ? 'over' : undefined}>
                  {formatHours(hours)} / {formatHours(person.weekly_hours)}
                  {over > 0 && <span className="over-by"> +{formatHours(over)}</span>}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const weekFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

// "2025-12-29" -> "Dec 29". Built and formatted in UTC: new Date("2025-12-29")
// is UTC midnight, which a browser west of UTC would show as Dec 28.
export function formatWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return weekFormat.format(new Date(Date.UTC(y, m - 1, d)))
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}
