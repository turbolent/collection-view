
export class Position {
  readonly x: number
  readonly y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

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
    return `Position(${this.x}, ${this.y})`
  }

  static in(direction: Direction, first: number, second: number) {
    return direction === Direction.HORIZONTAL
      ? new Position(first, second)
      : new Position(second, first)
  }
}

export class Line {
  readonly start: Position
  readonly end: Position

  constructor(start: Position, end: Position) {
    this.start = start
    this.end = end
  }

  toString() {
    return `Line(${this.start}, ${this.end})`
  }
}

export class Size {
  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }

  get(direction: Direction) {
    return direction === Direction.HORIZONTAL
      ? this.width
      : this.height
  }

  toString() {
    return `Size(${this.width}, ${this.height})`
  }

  static in(direction: Direction, first: number, second: number) {
    return direction === Direction.HORIZONTAL
      ? new Size(first, second)
      : new Size(second, first)
  }
}

export class Range {
  readonly start: number
  readonly end: number

  constructor(start: number, end: number) {
    this.start = start
    this.end = end
  }

  toString() {
    return `Range(${this.start}, ${this.end})`
  }
}

export class Ranges {
  readonly horizontal: Range
  readonly vertical: Range

  constructor(horizontal: Range, vertical: Range) {
    this.horizontal = horizontal
    this.vertical = vertical
  }

  get(direction: Direction): Range {
    return direction === Direction.HORIZONTAL
      ? this.horizontal
      : this.vertical
  }

  toString() {
    return `Ranges(${this.horizontal}, ${this.vertical})`
  }
}

export class Insets {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number

  constructor(top: number, bottom: number, left: number, right: number) {
    this.top = top
    this.bottom = bottom
    this.left = left
    this.right = right
  }

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
  readonly horizontal: number
  readonly vertical: number

  constructor(horizontal: number, vertical: number) {
    this.horizontal = horizontal
    this.vertical = vertical
  }

  get(direction: Direction): number {
    return direction === Direction.HORIZONTAL
      ? this.horizontal
      : this.vertical
  }

  toString() {
    return `Spacing(${this.horizontal}, ${this.vertical})`
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
