// hoursOver returns how many hours a person-week is over capacity, or 0 when
// it isn't. Exactly at capacity is not over. Zero capacity (Eli) is over as
// soon as anything is allocated, with no percentage to divide by.
export function hoursOver(allocated: number, capacity: number): number {
  return allocated > capacity ? allocated - capacity : 0
}
