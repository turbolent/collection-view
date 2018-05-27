import { Line, Position } from './types'

export function unique<T>(items: T[]): T[] {
  const seen = new Map<T, boolean>()
  return items.filter((item) => {
    if (seen.has(item)) {
      return false
    }
    seen.set(item, true)
    return true
  })
}

export function sort(indices: number[]): number[] {
  return indices.sort((a, b) => a < b ? -1 : 1)
}

export function coalesce<T>(value: T | undefined, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue
  }

  return value
}

export function assert(f: () => boolean) {
  if (process.env.NODE_ENV !== 'production') {
    if (!f()) {
      throw new Error('')
    }
  }
}

export function range(min: number, max: number): number[] {
  const count = Math.max(0, max - min)
  return Array.from(Array(count),
                    (_, index) => min + index)
}

export function intersect(line1: Line, line2: Line): Position | undefined {

  const {start: {x: x1, y: y1}, end: {x: x2, y: y2}} = line1
  const {start: {x: x3, y: y3}, end: {x: x4, y: y4}} = line2

  const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)

  // parallel?
  if (Math.abs(denominator) <= Number.EPSILON) {
    return
  }

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
    return
  }

  return new Position(
    x1 + ua * (x2 - x1),
    y1 + ua * (y2 - y1)
  )
}

export interface Style {
  [property: string]: any
}
