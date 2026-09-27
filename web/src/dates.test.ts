import { describe, expect, it } from 'vitest'
import { endOfWeek, isISODate, startOfWeek, weeksBetween } from './dates'

describe('startOfWeek / endOfWeek', () => {
  it('snaps to Monday and Sunday across a year boundary', () => {
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29') // a Thursday
    expect(endOfWeek('2026-01-01')).toBe('2026-01-04')
  })

  it('leaves a Monday alone and treats Sunday as the end of its week', () => {
    expect(startOfWeek('2025-12-29')).toBe('2025-12-29')
    expect(startOfWeek('2026-01-04')).toBe('2025-12-29')
  })
})

describe('weeksBetween', () => {
  it('counts whole weeks the grid will show', () => {
    expect(weeksBetween('2025-12-29', '2026-01-16')).toBe(3)
    expect(weeksBetween('2026-01-01', '2026-01-01')).toBe(1)
  })
})

describe('isISODate', () => {
  it('only accepts the YYYY-MM-DD form the API takes', () => {
    expect(isISODate('2026-02-28')).toBe(true)
    expect(isISODate('2026-01-01T10:00')).toBe(false) // Temporal alone accepts this
  })
})
