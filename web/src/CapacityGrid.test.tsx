import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CapacityGrid } from './CapacityGrid'

// jsdom has <dialog> but not showModal/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const capacity = {
  weeks: ['2025-12-29', '2026-01-05'],
  people: [{ id: 1, name: 'Ana Ferreira', weekly_hours: 40, allocated: [56, 0] }],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Serves the capacity GET and hands PATCHes to the given handler.
function stubFetch(patch: (body: { weekly_hours: number }) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') return patch(JSON.parse(String(init.body)))
    return json(capacity)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function openEditorAndSave(hours: string) {
  render(<CapacityGrid from="2025-12-29" to="2026-01-11" onRangeChange={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: /Edit weekly hours for Ana Ferreira/ }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: hours } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
  return dialog
}

function anaFirstWeek() {
  const row = screen.getByRole('row', { name: /Ana Ferreira/ })
  return within(row).getAllByRole('cell')[1] // [0] is the weekly hours button
}

describe('editing weekly hours', () => {
  it('updates the row from the saved value and closes the dialog', async () => {
    stubFetch((body) => json({ id: 1, name: 'Ana Ferreira', weekly_hours: body.weekly_hours }))
    await openEditorAndSave('60')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(anaFirstWeek().textContent).toBe('56 / 60')
    expect(anaFirstWeek().className).not.toContain('over')
    expect(screen.getByRole('status').textContent).toContain('Ana Ferreira is now at 60 hours')
  })

  it('keeps the grid on the saved value and the typed value in the dialog when the save fails', async () => {
    stubFetch(() => new Response('database is down', { status: 500 }))

    const dialog = await openEditorAndSave('60')

    await within(dialog).findByRole('alert')
    expect(within(dialog).getByRole('alert').textContent).toContain("wasn't saved")
    expect((within(dialog).getByRole('spinbutton') as HTMLInputElement).value).toBe('60')
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeDefined()
    expect(anaFirstWeek().textContent).toBe('56 / 40 +16')
    expect(anaFirstWeek().className).toContain('over')
  })

  it('does not send a value outside 0 to 168', async () => {
    const fetchMock = stubFetch(() => json({}))

    const dialog = await openEditorAndSave('200')

    expect(within(dialog).getByText('Must be between 0 and 168.')).toBeDefined()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })
})
