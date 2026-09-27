import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapacityGrid } from './CapacityGrid'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const capacity = {
  weeks: ['2025-12-29', '2026-01-05'],
  people: [{ id: 1, name: 'Ana Ferreira', weekly_hours: 40, allocated: [56, 0] }],
  total: 1,
  offset: 0,
  limit: 20,
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

function renderGrid() {
  render(
    <CapacityGrid
      from="2025-12-29"
      to="2026-01-11"
      page={1}
      name=""
      onRangeChange={() => {}}
      onPageChange={() => {}}
      onNameChange={() => {}}
    />,
  )
}

function anaRow() {
  return screen.getByRole('row', { name: /Ana Ferreira/ })
}

async function openEditorAndSave(hours: string) {
  renderGrid()
  fireEvent.click(await screen.findByRole('button', { name: /Edit weekly hours for Ana Ferreira/ }))
  fireEvent.change(within(anaRow()).getByRole('spinbutton'), { target: { value: hours } })
  fireEvent.click(within(anaRow()).getByRole('button', { name: 'Save' }))
}

function anaFirstWeek() {
  return within(anaRow()).getAllByRole('cell')[1] // [0] is the weekly hours cell
}

describe('editing weekly hours', () => {
  it('updates the row from the saved value and closes the editor', async () => {
    stubFetch((body) => json({ id: 1, name: 'Ana Ferreira', weekly_hours: body.weekly_hours }))
    await openEditorAndSave('60')

    await waitFor(() => expect(screen.queryByRole('spinbutton')).toBeNull())
    expect(anaFirstWeek().textContent).toBe('56 / 60')
    expect(anaFirstWeek().className).not.toContain('over')
    expect(screen.getByRole('status').textContent).toContain('Ana Ferreira is now at 60 hours')
  })

  it('keeps the grid on the saved value and the typed value in the editor when the save fails', async () => {
    stubFetch(() => new Response('database is down', { status: 500 }))

    await openEditorAndSave('60')

    await within(anaRow()).findByRole('alert')
    expect(within(anaRow()).getByRole('alert').textContent).toContain("wasn't saved")
    expect((within(anaRow()).getByRole('spinbutton') as HTMLInputElement).value).toBe('60')
    expect(within(anaRow()).getByRole('button', { name: 'Try again' })).toBeDefined()
    expect(anaFirstWeek().textContent).toBe('56 / 40 +16')
    expect(anaFirstWeek().className).toContain('over')
  })

  it('does not send a value outside 0 to 168', async () => {
    const fetchMock = stubFetch(() => json({}))

    await openEditorAndSave('200')

    expect(within(anaRow()).getByText('Must be between 0 and 168.')).toBeDefined()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })
})

describe('paging through people', () => {
  it('asks for the offset of the page it is on and moves one page at a time', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const offset = Number(new URL(url, 'http://x').searchParams.get('offset'))
      const person =
        offset === 0
          ? { id: 1, name: 'Ana Ferreira', weekly_hours: 40, allocated: [56, 0] }
          : { id: 2, name: 'Bo Lindqvist', weekly_hours: 40, allocated: [0, 48] }
      return json({ ...capacity, people: [person], total: 21, offset, limit: 20 })
    })
    vi.stubGlobal('fetch', fetchMock)
    Element.prototype.scrollIntoView = () => {}

    function Paged() {
      const [page, setPage] = useState(1)
      return <CapacityGrid from="2025-12-29" to="2026-01-11" page={page} name="" onRangeChange={() => {}} onPageChange={setPage} onNameChange={() => {}} />
    }
    render(<Paged />)

    await screen.findByText('Ana Ferreira')
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('offset=0')
    expect(screen.getByRole('button', { name: /Previous page/ })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: /Next page/ }))
    await screen.findByText('Bo Lindqvist')
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('offset=20')
    expect(screen.getByText(/People 21–21 of 21/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Next page/ })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: /Previous page/ }))
    await screen.findByText('Ana Ferreira')
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('offset=0')
  })

  it('moves a link that points past the end back to the last page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...capacity, people: [], total: 21, offset: 180, limit: 20 })))
    const onPageChange = vi.fn()

    render(<CapacityGrid from="2025-12-29" to="2026-01-11" page={10} name="" onRangeChange={() => {}} onPageChange={onPageChange} onNameChange={() => {}} />)

    await waitFor(() => expect(onPageChange).toHaveBeenCalledWith(2))
  })
})

describe('filtering by name', () => {
  it('sends the trimmed name once typing pauses and starts from the first page', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const q = new URL(url, 'http://x').searchParams.get('q')
      return json(q === 'bo' ? { ...capacity, people: [], total: 0 } : { ...capacity, total: 41 })
    })
    vi.stubGlobal('fetch', fetchMock)

    function Filtered() {
      const [page, setPage] = useState(3)
      const [name, setName] = useState('')
      return (
        <CapacityGrid
          from="2025-12-29"
          to="2026-01-11"
          page={page}
          name={name}
          onRangeChange={() => {}}
          onPageChange={setPage}
          onNameChange={(n) => {
            setName(n)
            setPage(1)
          }}
        />
      )
    }
    render(<Filtered />)
    await screen.findByText('Ana Ferreira')

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  bo ' } })

    await screen.findByText(/No one's name contains "bo"/)
    const url = new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://x')
    expect(url.searchParams.get('q')).toBe('bo')
    expect(url.searchParams.get('offset')).toBe('0')
  })
})

describe('while a row is being edited', () => {
  it('locks navigation, and unlocks it on cancel', async () => {
    stubFetch(() => json({}))
    renderGrid()
    fireEvent.click(await screen.findByRole('button', { name: /Edit weekly hours for Ana Ferreira/ }))

    for (const name of [/Previous week/, /This week/, /Next week/]) {
      expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true)
    }
    expect(screen.getByRole('searchbox')).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('From')).toHaveProperty('disabled', true)

    fireEvent.click(within(anaRow()).getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: /Next week/ })).toHaveProperty('disabled', false)
    expect(screen.getByRole('searchbox')).toHaveProperty('disabled', false)
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})
