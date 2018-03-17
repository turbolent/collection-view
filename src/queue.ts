
export type Operation = (resolve: () => void) => void

export class Queue {

  private current: Promise<void> | undefined

  private operations: Operation[] = []

  queue(operation: Operation): Promise<void> {
    if (this.current === undefined) {
      return this.start(operation)
    }

    let resolveQueued: () => void
    const promise = new Promise<void>((resolve) => {
      resolveQueued = resolve
    })
    this.operations.push((resolve) => {
      operation(() => {
        resolveQueued()
        resolve()
      })
    })
    return promise
  }

  private start(operation: Operation): Promise<void> {
    const promise = new Promise<void>(operation)
      .then(() => {
        this.current = undefined

        const next = this.operations.shift()
        if (next === undefined) {
          return
        }
        // TODO: or create new promise?
        setTimeout(() => this.start(next), 0)
      })
    this.current = promise
    return promise
  }
}
