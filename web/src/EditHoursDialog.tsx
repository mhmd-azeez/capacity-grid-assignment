import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, updateWeeklyHours, type Person } from './api'

type Props = {
  person: Person
  onSaved: (person: Person) => void
  onClose: () => void
}

// A modal for one person's weekly hours. It stays open until the server has
// the new value, so anything the grid shows after it closes is saved.
export function EditHoursDialog({ person, onSaved, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(String(person.weekly_hours))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const problem = hoursProblem(value)

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

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="edit-hours-title"
      // Escape fires cancel. Don't let it close the dialog mid-save, or the
      // manager can't tell whether the save went through.
      onCancel={(e) => {
        e.preventDefault()
        if (!saving) onClose()
      }}
    >
      <form onSubmit={save}>
        <h2 id="edit-hours-title">{person.name}</h2>
        <label>
          Weekly hours{' '}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={168}
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            aria-invalid={problem ? true : undefined}
            autoFocus
          />
        </label>
        <p className="hint">Applies to every week, past ones included.</p>
        {problem && <p className="field-error">{problem}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" disabled={saving || problem !== null}>
            {saving ? 'Saving…' : error ? 'Try again' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
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
