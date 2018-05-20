import CollectionViewLayout from './layout'
import { Direction, Insets, Position, Ranges, Size, Spacing } from './types'
import { coalesce, range } from './utils'

export interface GridLayoutParameters {
  readonly direction?: Direction
  readonly insets?: Insets
  readonly spacing?: Spacing
  readonly itemSize?: Size
}

export class GridLayoutElementInfo {

  constructor(readonly row: number,
              readonly column: number) {}
}

export default class GridLayout implements CollectionViewLayout {

  static readonly DEFAULT_DIRECTION: Direction = Direction.VERTICAL
  static readonly DEFAULT_INSETS: Insets = new Insets(10, 10, 10, 10)
  static readonly DEFAULT_SPACING: Spacing = new Spacing(20, 20)
  static readonly DEFAULT_ITEM_SIZE: Size = new Size(200, 200)

  private readonly _otherDirection: Direction
  private _otherItemCount: number = 0
  private _otherContainerSizeConstraint: number = 0

  readonly direction: Direction
  readonly insets: Insets
  readonly spacing: Spacing
  readonly itemSize: Size

  constructor({direction, insets, spacing, itemSize}: GridLayoutParameters = {}) {
    this.direction = coalesce(direction, GridLayout.DEFAULT_DIRECTION)
    this._otherDirection = this.direction.other
    this.insets = coalesce(insets, GridLayout.DEFAULT_INSETS)
    this.spacing = coalesce(spacing, GridLayout.DEFAULT_SPACING)
    this.itemSize = coalesce(itemSize, GridLayout.DEFAULT_ITEM_SIZE)
  }

  private getOtherItemCount(containerSize: Size): number {
    const otherDirection = this._otherDirection
    const otherStartInset = this.insets.getStart(otherDirection)
    const otherEndInset = this.insets.getEnd(otherDirection)
    const otherContainerSize = containerSize.get(otherDirection)
    const otherAvailableSpace = otherContainerSize - otherStartInset - otherEndInset
    const otherSpacing = this.spacing.get(otherDirection)
    const otherItemSize = this.itemSize.get(otherDirection)
    return Math.floor((otherAvailableSpace + otherSpacing) / (otherItemSize + otherSpacing))
  }

  configureElement(element: HTMLElement, index: number): void {
    const {width, height} = this.itemSize
    element.style.width = `${width}px`
    element.style.height = `${height}px`
  }

  updateContainerSize(containerSize: Size): void {
    this._otherContainerSizeConstraint = containerSize.get(this._otherDirection)
    this._otherItemCount = this.getOtherItemCount(containerSize)
  }

  getIndices(ranges: Ranges, count: number, containerSize: Size): number[] {
    const thisRange = ranges.get(this.direction)
    const startInset = this.insets.getStart(this.direction)
    const start = thisRange.start - startInset
    const end = thisRange.end - startInset
    const otherItemCount = this.getOtherItemCount(containerSize)
    const spacing = this.spacing.get(this.direction)
    const itemSize = this.itemSize.get(this.direction)
    const itemAndSpacing = itemSize + spacing
    const startIndex = Math.max(0, Math.floor(start / itemAndSpacing) * otherItemCount)
    const endIndex = Math.min(Math.ceil(end / itemAndSpacing) * otherItemCount, count)
    return range(startIndex, endIndex)
  }

  getElementPosition(index: number): Position {
    const rowIndex = Math.floor(index / this._otherItemCount)
    const columnIndex = index % this._otherItemCount
    const otherDirection = this._otherDirection
    const spacing = this.spacing.get(this.direction)
    const otherSpacing = this.spacing.get(otherDirection)
    const startInset = this.insets.getStart(this.direction)
    const otherStartInset = this.insets.getStart(otherDirection)
    const otherEndInset = this.insets.getEnd(otherDirection)
    const itemSize = this.itemSize.get(this.direction)
    const itemSizeAndSpacing = itemSize + spacing
    const otherItemSize = this.itemSize.get(otherDirection)
    const otherItemSizeAndSpacing = otherItemSize + otherSpacing
    const otherAvailableSpace = this._otherContainerSizeConstraint - otherStartInset - otherEndInset
    const diff = otherAvailableSpace + otherSpacing - this._otherItemCount * otherItemSizeAndSpacing

    return Position.in(
      this.direction,
      startInset + rowIndex * itemSizeAndSpacing,
      otherStartInset + columnIndex * otherItemSizeAndSpacing + Math.max(0, diff / 2),
    )
  }

  getContentSize(count: number, containerSize: Size): Size {
    const otherItemCount = this.getOtherItemCount(containerSize)
    const otherSize = containerSize.get(this._otherDirection)
    const rowCount = Math.ceil(count / otherItemCount)
    const startInset = this.insets.getStart(this.direction)
    const endInset = this.insets.getEnd(this.direction)
    const spacing = this.spacing.get(this.direction)
    const itemSizeAndSpacing = this.itemSize.get(this.direction) + spacing
    const size = startInset + rowCount * itemSizeAndSpacing + endInset
    return Size.in(
      this.direction,
      size,
      otherSize
    )
  }

  convertPositionInSize(position: Position,
                        newContainerSize: Size,
                        oldLayout: CollectionViewLayout): Position {

    const oldGridLayout = oldLayout instanceof GridLayout
                          ? oldLayout as GridLayout
                          : this
    const oldDirection = oldGridLayout.direction
    const oldPosition = position.get(oldDirection)
    const oldSpacing = oldGridLayout.spacing.get(oldDirection)
    const oldItemSizeAndSpacing = oldGridLayout.itemSize.get(oldDirection) + oldSpacing
    const oldRowIndex = Math.floor(oldPosition / oldItemSizeAndSpacing)
    const oldColumnIndex = oldRowIndex * oldGridLayout._otherItemCount
    const oldItemOffset = oldPosition % oldItemSizeAndSpacing

    const newItemCount = this.getOtherItemCount(newContainerSize)
    const newRowIndex = Math.floor(oldColumnIndex / newItemCount)
    const newDirection = this.direction
    const newSpacing = this.spacing.get(newDirection)
    const newItemSizeAndSpacing = this.itemSize.get(newDirection) + newSpacing
    const newPosition = newRowIndex * newItemSizeAndSpacing + oldItemOffset

    return Position.in(
      this.direction,
      newPosition,
      0
    )
  }

  getElementInfo(index: number): GridLayoutElementInfo {
      const rowIndex = Math.floor(index / this._otherItemCount)
      const columnIndex = index % this._otherItemCount
      return new GridLayoutElementInfo(rowIndex, columnIndex)
  }
}
