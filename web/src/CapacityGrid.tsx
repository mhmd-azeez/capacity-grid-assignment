import { useEffect, useState } from 'react'
import { fetchCapacity, MAX_WEEKS, type CapacityResponse, type Person } from './api'
import { hoursOver } from './capacity'
import { EditHoursDialog } from './EditHoursDialog'
import { addDays, formatDay, formatDayYear, isISODate, startOfWeek, today, weeksBetween } from './dates'

export type Range = {
  from: string
  to: string
}

type Props = Range & {
  onRangeChange: (range: Range) => void
}

type State = {
  // The last range that loaded. Kept on screen while the next one loads, so
  // paging through weeks doesn't blank the grid on every click.
  data: CapacityResponse | null
  loading: boolean
  error: string | null
}

// CapacityGrid renders one row per person and one column per week, showing
// how allocated each person is against their weekly hours.
export function CapacityGrid({ from, to, onRangeChange }: Props) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState<Person | null>(null)
  const [saved, setSaved] = useState<Person | null>(null)

  useEffect(() => {
    // Abort the in-flight request when the range changes or the grid
    // unmounts, so a slow old response can't overwrite a newer one.
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchCapacity(from, to, controller.signal).then(
      (data) => setState({ data, loading: false, error: null }),
      (err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        setState((s) => ({ ...s, loading: false, error: message }))
      },
    )
    return () => controller.abort()
  }, [from, to, attempt])

  function onSaved(person: Person) {
    setEditing(null)
    setSaved(person)
    // Allocations don't depend on weekly hours, so patching the one number
    // is enough to keep every cell and highlight in the row correct.
    setState((s) => ({
      ...s,
      data: s.data && {
        ...s.data,
        people: s.data.people.map((p) => (p.id === person.id ? { ...p, weekly_hours: person.weekly_hours } : p)),
      },
    }))
    // A range that was already loading was requested before the save and
    // may carry the old value, so ask again.
    if (state.loading) setAttempt((n) => n + 1)
  }

  const weeks = weeksBetween(from, to)
  const shift = (days: number) => onRangeChange({ from: addDays(from, days), to: addDays(to, days) })
  const thisWeek = () => {
    const monday = startOfWeek(today())
    onRangeChange({ from: monday, to: addDays(monday, weeks * 7 - 1) })
  }

  return (
    <section>
      <div className="toolbar">
        <button type="button" onClick={() => shift(-7)}>
          ← Previous week
        </button>
        <button type="button" onClick={thisWeek}>
          This week
        </button>
        <button type="button" onClick={() => shift(7)}>
          Next week →
        </button>
        <RangePicker from={from} to={to} onRangeChange={onRangeChange} />
      </div>

      <p className="range">
        {formatDayYear(from)} to {formatDayYear(to)} · {weeks} {weeks === 1 ? 'week' : 'weeks'}
        {state.loading && state.data && <span className="status"> · Updating…</span>}
      </p>

      <p role="status" className="saved">
        {saved && `Saved: ${saved.name} is now at ${formatHours(saved.weekly_hours)} hours a week.`}
      </p>

      <Body
        state={state}
        onRetry={() => setAttempt((n) => n + 1)}
        onEdit={(person) => {
          setSaved(null) // an old confirmation next to a new edit is misleading
          setEditing(person)
        }}
      />

      {editing && <EditHoursDialog person={editing} onSaved={onSaved} onClose={() => setEditing(null)} />}
    </section>
  )
}

type BodyProps = {
  state: State
  onRetry: () => void
  onEdit: (person: Person) => void
}

function Body({ state, onRetry, onEdit }: BodyProps) {
  if (state.error) {
    // The old table belongs to a different range, so don't leave it up
    // under a heading that no longer matches it.
    return (
      <div role="alert" className="error">
        <p>Couldn't load capacity: {state.error}</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }
  if (!state.data) {
    return <p>Loading capacity…</p>
  }

  const { weeks, people } = state.data
  return (
    <table className={state.loading ? 'stale' : undefined} aria-busy={state.loading}>
      <thead>
        <tr>
          <th scope="col">Person</th>
          <th scope="col">Weekly hours</th>
          {weeks.map((week) => (
            <th scope="col" key={week}>
              {formatDay(week)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {people.map((person) => (
          <tr key={person.id}>
            <th scope="row">{person.name}</th>
            <td>
              <button
                type="button"
                className="edit-hours"
                onClick={() => onEdit(person)}
                aria-label={`Edit weekly hours for ${person.name}, currently ${formatHours(person.weekly_hours)}`}
              >
                {formatHours(person.weekly_hours)} h ✎
              </button>
            </td>
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

// Two date inputs. Edits stay local until they make a valid range, so a
// half-typed date never reaches the API.
function RangePicker({ from, to, onRangeChange }: Props) {
  const [draft, setDraft] = useState({ from, to })

  // When the range changes from outside (the week buttons), show it.
  useEffect(() => setDraft({ from, to }), [from, to])

  const problem = rangeProblem(draft.from, draft.to)

  const update = (next: Range) => {
    setDraft(next)
    if (!rangeProblem(next.from, next.to)) onRangeChange(next)
  }

  return (
    <span className="range-picker">
      <label>
        From <input type="date" value={draft.from} onChange={(e) => update({ ...draft, from: e.target.value })} />
      </label>
      <label>
        To <input type="date" value={draft.to} onChange={(e) => update({ ...draft, to: e.target.value })} />
      </label>
      {problem && (
        <span role="alert" className="field-error">
          {problem}
        </span>
      )}
    </span>
  )
}

function rangeProblem(from: string, to: string): string | null {
  if (!isISODate(from) || !isISODate(to)) return 'Pick both dates.'
  if (to < from) return 'The end date is before the start date.'
  if (weeksBetween(from, to) > MAX_WEEKS) return `That's more than ${MAX_WEEKS} weeks.`
  return null
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}
