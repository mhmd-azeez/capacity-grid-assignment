import { useEffect, useRef, useState } from 'react'
import { fetchCapacity, MAX_WEEKS, PAGE_SIZE, type CapacityResponse, type Person } from './api'
import { hoursOver } from './capacity'
import { EditHoursDialog } from './EditHoursDialog'
import { addDays, formatDay, formatDayYear, isISODate, startOfWeek, today, weeksBetween } from './dates'

export type Range = {
  from: string
  to: string
}

type Props = Range & {
  // 1-based page of people.
  page: number
  // Name filter; '' shows everyone.
  name: string
  onRangeChange: (range: Range) => void
  onPageChange: (page: number) => void
  onNameChange: (name: string) => void
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
export function CapacityGrid({ from, to, page, name, onRangeChange, onPageChange, onNameChange }: Props) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState<Person | null>(null)
  const [saved, setSaved] = useState<Person | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Abort the in-flight request when the range changes or the grid
    // unmounts, so a slow old response can't overwrite a newer one.
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchCapacity(from, to, (page - 1) * PAGE_SIZE, name, controller.signal).then(
      (data) => setState({ data, loading: false, error: null }),
      (err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        setState((s) => ({ ...s, loading: false, error: message }))
      },
    )
    return () => controller.abort()
  }, [from, to, page, name, attempt])

  // A shared link can point past the end if people were removed since.
  // Land on the last page that has anyone on it.
  const lastPage = state.data ? Math.max(1, Math.ceil(state.data.total / PAGE_SIZE)) : null
  useEffect(() => {
    if (lastPage !== null && page > lastPage) onPageChange(lastPage)
  }, [page, lastPage, onPageChange])

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

  function goToPage(next: number) {
    onPageChange(next)
    topRef.current?.scrollIntoView({ block: 'start' })
  }

  const weeks = weeksBetween(from, to)
  const shift = (days: number) => onRangeChange({ from: addDays(from, days), to: addDays(to, days) })
  const thisWeek = () => {
    const monday = startOfWeek(today())
    onRangeChange({ from: monday, to: addDays(monday, weeks * 7 - 1) })
  }

  return (
    <section>
      <div className="toolbar" ref={topRef}>
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
        <NameSearch name={name} onNameChange={onNameChange} />
      </div>

      <p className="range">
        {formatDayYear(from)} to {formatDayYear(to)} · {weeks} {weeks === 1 ? 'week' : 'weeks'}
        {state.loading && state.data && <span className="status"> · Updating…</span>}
      </p>
      <p className="weekdays-note">Hours count Monday to Friday. Assigned weekend days aren't included.</p>

      <p role="status" className="saved">
        {saved && `Saved: ${saved.name} is now at ${formatHours(saved.weekly_hours)} hours a week.`}
      </p>

      <Body
        name={name}
        state={state}
        onRetry={() => setAttempt((n) => n + 1)}
        onEdit={(person) => {
          setSaved(null) // an old confirmation next to a new edit is misleading
          setEditing(person)
        }}
      />

      {state.data && !state.error && (
        <Pager
          // From the data on screen, not the page asked for: while the next
          // page loads, the old rows are still showing.
          offset={state.data.offset}
          shown={state.data.people.length}
          total={state.data.total}
          onPrevious={page > 1 ? () => goToPage(page - 1) : undefined}
          onNext={lastPage !== null && page < lastPage ? () => goToPage(page + 1) : undefined}
          disabled={state.loading}
        />
      )}

      {editing && <EditHoursDialog person={editing} onSaved={onSaved} onClose={() => setEditing(null)} />}
    </section>
  )
}

type BodyProps = {
  name: string
  state: State
  onRetry: () => void
  onEdit: (person: Person) => void
}

function Body({ name, state, onRetry, onEdit }: BodyProps) {
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
  if (people.length === 0 && name) {
    return <p className={state.loading ? 'stale' : undefined}>No one's name contains "{name}".</p>
  }
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

type PagerProps = {
  offset: number
  shown: number
  total: number
  onPrevious?: () => void
  onNext?: () => void
  disabled: boolean
}

function Pager({ offset, shown, total, onPrevious, onNext, disabled }: PagerProps) {
  const first = offset + 1
  return (
    <nav className="pager" aria-label="People pages">
      <button type="button" onClick={onPrevious} disabled={!onPrevious || disabled}>
        ← Previous page
      </button>
      <span>
        People {first}–{first + shown - 1} of {total}
      </span>
      <button type="button" onClick={onNext} disabled={!onNext || disabled}>
        Next page →
      </button>
    </nav>
  )
}

// Searches once typing pauses, so each keystroke doesn't fire a request.
function NameSearch({ name, onNameChange }: { name: string; onNameChange: (name: string) => void }) {
  const [draft, setDraft] = useState(name)

  // When the name changes from outside, show it.
  useEffect(() => setDraft(name), [name])

  useEffect(() => {
    const trimmed = draft.trim()
    if (trimmed === name) return
    const timer = setTimeout(() => onNameChange(trimmed), 250)
    return () => clearTimeout(timer)
  }, [draft, name, onNameChange])

  return (
    <label className="name-search">
      Name{' '}
      <input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Filter people" />
    </label>
  )
}

// Two date inputs. Edits stay local until they make a valid range, so a
// half-typed date never reaches the API.
function RangePicker({ from, to, onRangeChange }: Range & { onRangeChange: (range: Range) => void }) {
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
