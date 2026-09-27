// Shapes returned by the Go API. Dates are calendar dates as "YYYY-MM-DD"
// strings, never timestamps, so they can't shift with the browser's zone.

// Longest range the API accepts. Keep in step with maxWeeks in api/capacity.go.
export const MAX_WEEKS = 106

// People per page.
export const PAGE_SIZE = 20

export type CapacityPerson = {
  id: number
  name: string
  weekly_hours: number
  // One entry per week, index-aligned with CapacityResponse.weeks.
  allocated: number[]
}

export type CapacityResponse = {
  // Monday of each week in the range.
  weeks: string[]
  people: CapacityPerson[]
  // Everyone on the roster, across all pages.
  total: number
  offset: number
  limit: number
}

export type Person = {
  id: number
  name: string
  weekly_hours: number
}

// An HTTP error from the API, with the status kept so callers can word the
// message for the manager.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function fetchCapacity(
  from: string,
  to: string,
  offset: number,
  signal?: AbortSignal,
): Promise<CapacityResponse> {
  const params = new URLSearchParams({ from, to, limit: String(PAGE_SIZE), offset: String(offset) })
  const res = await fetch(`/api/capacity?${params}`, { signal })
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res))
  }
  return res.json()
}

export async function updateWeeklyHours(id: number, weeklyHours: number): Promise<Person> {
  const res = await fetch(`/api/people/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekly_hours: weeklyHours }),
  })
  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res))
  }
  return res.json()
}

// The API answers 400s as {"error": "..."} and 500s as plain text.
async function errorMessage(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const body = JSON.parse(text)
    if (typeof body?.error === 'string') return body.error
  } catch {
    // not JSON
  }
  return text.trim() || `${res.status} ${res.statusText}`
}
