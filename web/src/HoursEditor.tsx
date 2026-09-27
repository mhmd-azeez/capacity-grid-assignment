import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ApiError, updateWeeklyHours, type Person } from './api'

type Props = {
  person: Person
  onSaved: (person: Person) => void
  onCancel: () => void
}

// Edits one person's weekly hours in place, in their row. It stays open
// until the server has the new value, so anything the row shows after it
// closes is saved. The grid locks everything else while it's open.
export function HoursEditor({ person, onSaved, onCancel }: Props) {
  const [value, setValue] = useState(String(person.weekly_hours))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problem = hoursProblem(value)
  const inputId = `hours-${person.id}`
  const messageId = `hours-${person.id}-message`

  async function save(e: FormEvent) {
    e.preventDefault()
    if (problem || saving) return
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateWeeklyHours(person.id, Number(value)))
    } catch (err) {
      setError(saveErrorMessage(err))
      setSaving(false)
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    // Not mid-save: the manager couldn't tell whether it went through.
    if (e.key === 'Escape' && !saving) onCancel()
  }

  return (
    <form className="hours-editor" onSubmit={save} onKeyDown={onKeyDown} aria-busy={saving}>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        min={0}
        max={168}
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        aria-label={`Weekly hours for ${person.name}`}
        aria-invalid={problem ? true : undefined}
        aria-describedby={messageId}
        autoFocus
      />
      <button type="submit" disabled={saving || problem !== null}>
        {saving ? 'Saving…' : error ? 'Try again' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
      <div id={messageId}>
        {problem && <p className="field-error">{problem}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}

function hoursProblem(value: string): string | null {
  if (value.trim() === '') return 'Enter a number of hours.'
  const n = Number(value)
  if (!Number.isFinite(n)) return 'Enter a number of hours.'
  if (n < 0 || n > 168) return 'Must be between 0 and 168.'
  return null
}

function saveErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'This person no longer exists.'
    if (err.status === 400) return err.message
    return `Couldn't save, the server had a problem (${err.status}). Your change wasn't saved.`
  }
  // fetch rejects with a TypeError when the request never got an answer.
  return "Couldn't reach the server. Your change wasn't saved."
}
