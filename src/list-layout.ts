
import { NumberTuple } from './types'
import CollectionViewLayout from './layout'


export default class ListLayout implements CollectionViewLayout {
  readonly rowHeight: number;

  static readonly DEFAULT_ROW_HEIGHT: number = 200

  constructor(rowHeight: number = ListLayout.DEFAULT_ROW_HEIGHT) {
    this.rowHeight = rowHeight
  }

  configureElement(element: HTMLElement, index: number): void {
    element.style.height = `${this.rowHeight}px`
  }

  getIndices(xOffsets: NumberTuple, yOffsets: NumberTuple, count: number, containerSize: NumberTuple): number[] {
    const [offset, endOffset] = yOffsets
    const startIndex = Math.max(0, Math.floor(offset / this.rowHeight))
    const endIndex = Math.min(Math.ceil(endOffset / this.rowHeight), count)
    const indices = []
    for (let i = startIndex; i < endIndex; i += 1)
      indices.push(i)
    return indices
  }

  getElementPosition(index: number): NumberTuple {
    return [0, index * this.rowHeight]
  }

  getContentSize(count: number, containerSize: NumberTuple): NumberTuple {
    const [containerWidth] = containerSize
    return [containerWidth, count * this.rowHeight]
  }

  convertPositionInSize(position: NumberTuple, newContainerSize: NumberTuple, oldLayout: CollectionViewLayout): NumberTuple {
    const oldListLayout = oldLayout instanceof ListLayout
                          ? oldLayout as ListLayout
                          : this
    const [x, y] = position
    const oldRowIndex = Math.floor(y / oldListLayout.rowHeight)
    const oldRowOffset = y % oldListLayout.rowHeight
    const newY = oldRowIndex * this.rowHeight + oldRowOffset
    return [x, newY]
  }
}
