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

export function coalesce<T>(value: T | undefined | null, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue
  }

  return value
}
