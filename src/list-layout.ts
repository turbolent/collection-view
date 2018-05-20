import CollectionViewLayout from './layout'
import { Position, Size, Ranges } from './types'
import { range } from './utils'

export class ListLayoutElementInfo {
  constructor(readonly row: number) {}
}

export default class ListLayout implements CollectionViewLayout {

  readonly rowHeight: number

  static readonly DEFAULT_ROW_HEIGHT: number = 200

  constructor(rowHeight: number = ListLayout.DEFAULT_ROW_HEIGHT) {
    this.rowHeight = rowHeight
  }

  configureElement(element: HTMLElement, index: number): void {
    element.style.height = `${this.rowHeight}px`
  }

  getIndices(ranges: Ranges,
             count: number,
             containerSize: Size): number[] {

    const {start: offset, end: endOffset} = ranges.vertical
    const startIndex = Math.max(0, Math.floor(offset / this.rowHeight))
    const endIndex = Math.min(Math.ceil(endOffset / this.rowHeight), count)
    return range(startIndex, endIndex)
  }

  getElementPosition(index: number): Position {
    return new Position(0, index * this.rowHeight)
  }

  getContentSize(count: number, containerSize: Size): Size {
    const {width: containerWidth} = containerSize
    return new Size(containerWidth, count * this.rowHeight)
  }

  convertPositionInSize({x, y}: Position,
                        newContainerSize: Size,
                        oldLayout: CollectionViewLayout): Position {

    const oldListLayout = oldLayout instanceof ListLayout
                          ? oldLayout as ListLayout
                          : this
    const oldRowIndex = Math.floor(y / oldListLayout.rowHeight)
    const oldRowOffset = y % oldListLayout.rowHeight
    const newY = oldRowIndex * this.rowHeight + oldRowOffset
    return new Position(x, newY)
  }

  getElementInfo(index: number): ListLayoutElementInfo {
    return new ListLayoutElementInfo(index)
  }
}
