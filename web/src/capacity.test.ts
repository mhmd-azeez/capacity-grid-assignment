import { describe, expect, it } from 'vitest'
import { hoursOver } from './capacity'

describe('hoursOver', () => {
  it('is the excess when allocation is above capacity', () => {
    expect(hoursOver(56, 40)).toBe(16)
  })

  it('is 0 at exactly capacity', () => {
    expect(hoursOver(40, 40)).toBe(0)
  })

  it('is 0 below capacity', () => {
    expect(hoursOver(30, 40)).toBe(0)
  })

  it('treats any allocation against zero capacity as over', () => {
    expect(hoursOver(20, 0)).toBe(20)
    expect(hoursOver(0, 0)).toBe(0)
  })
})
