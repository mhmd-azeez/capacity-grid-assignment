// Shapes returned by the Go API. Dates are calendar dates as "YYYY-MM-DD"
// strings, never timestamps, so they can't shift with the browser's zone.

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
}

export async function fetchCapacity(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CapacityResponse> {
  const params = new URLSearchParams({ from, to })
  const res = await fetch(`/api/capacity?${params}`, { signal })
  if (!res.ok) {
    throw new Error(await errorMessage(res))
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
