
export class Position {

  constructor(
    readonly x: number,
    readonly y: number
  ) {}

  map(f: (coordinate: number) => number) {
    const newX = f(this.x)
    const newY = f(this.y)
    return new Position(newX, newY)
  }

  equals(other: Position) {
    return (
      other.x == this.x
      && other.y == this.y
    )
  }

  get(direction: Direction) {
    return direction === Direction.HORIZONTAL
      ? this.x
      : this.y
  }

  toString() {
    return `Position(x=${this.x}, y=${this.y})`
  }

  static in(direction: Direction, first: number, second: number) {
    return direction === Direction.HORIZONTAL
      ? new Position(first, second)
      : new Position(second, first)
  }
}

export class Line {

  constructor(
    readonly start: Position,
    readonly end: Position
  ) {}

  toString() {
    return `Line(start=${this.start}, end=${this.end})`
  }
}

export class Size {

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  get(direction: Direction) {
    return direction === Direction.HORIZONTAL
      ? this.width
      : this.height
  }

  toString() {
    return `Size(width=${this.width}, height=${this.height})`
  }

  static in(direction: Direction, first: number, second: number) {
    return direction === Direction.HORIZONTAL
      ? new Size(first, second)
      : new Size(second, first)
  }
}

export class Range {

  constructor(
    readonly start: number,
    readonly end: number
  ) {}

  toString() {
    return `Range(start=${this.start}, end=${this.end})`
  }
}

export class Ranges {

  constructor(
    readonly horizontal: Range,
    readonly vertical: Range
  ) {}

  get(direction: Direction): Range {
    return direction === Direction.HORIZONTAL
      ? this.horizontal
      : this.vertical
  }

  toString() {
    return `Ranges(horizontal=${this.horizontal}, vertical=${this.vertical})`
  }
}

export class Insets {

  constructor(
    readonly top: number,
    readonly bottom: number,
    readonly left: number,
    readonly right: number
  ) {}

  getStart(direction: Direction): number {
    return direction === Direction.HORIZONTAL
      ? this.left
      : this.top
  }

  getEnd(direction: Direction): number {
    return direction === Direction.HORIZONTAL
      ? this.right
      : this.bottom
  }

  toString() {
    return `Insets(top=${this.top}, bottom=${this.bottom}, left=${this.left}, right=${this.right})`
  }
}

export class Spacing {

  constructor(
    readonly horizontal: number,
    readonly vertical: number
  ) {}

  get(direction: Direction): number {
    return direction === Direction.HORIZONTAL
      ? this.horizontal
      : this.vertical
  }

  toString() {
    return `Spacing(horizontal=${this.horizontal}, vertical=${this.vertical})`
  }
}

export class Direction {
  static readonly HORIZONTAL = new Direction()
  static readonly VERTICAL = new Direction()

  private constructor() {}

  get other(): Direction {
    return this === Direction.HORIZONTAL
      ? Direction.VERTICAL
      : Direction.HORIZONTAL
  }

  toString() {
    return this === Direction.HORIZONTAL
      ? 'Direction.HORIZONTAL'
      : 'Direction.VERTICAL'
  }
}

export class Animation {
  constructor(readonly duration?: number,
              readonly delay?: number,
              readonly timingFunction?: string) {}
}

export type Purify<T extends string> = { [P in T]: T; }[T];

export type NonNullable<T> = T & {};

export type Required<T> = {
  [P in Purify<keyof T>]: NonNullable<T[P]>
}
