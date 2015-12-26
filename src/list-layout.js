export default class ListLayout {

  constructor() {
    this.rowHeight = 200
  }

  updateContainerSize() {}

  configureElement(element, _index) {
    element.style.height = `${this.rowHeight}px`
  }

  getIndices(xOffsets, yOffsets, count, _containerSize) {
    const [offset, endOffset] = yOffsets
    const startIndex = Math.max(0, Math.floor(offset / this.rowHeight))
    const endIndex = Math.min(Math.ceil(endOffset / this.rowHeight), count)
    const indices = []
    for (let i = startIndex; i < endIndex; i += 1)
      indices.push(i)
    return indices
  }

  getElementPosition(index) {
    return [0, index * this.rowHeight]
  }

  getContentSize(count, containerSize) {
    const [containerWidth] = containerSize
    return [containerWidth, count * this.rowHeight]
  }

  convertPositionInSize(position, _newContainerSize, oldLayout) {
    const oldListLayout = oldLayout instanceof ListLayout
                          ? oldLayout
                          : this
    const [x, y] = position
    const oldRowIndex = Math.floor(y / oldListLayout.rowHeight)
    const oldRowOffset = y % oldListLayout.rowHeight
    const newY = oldRowIndex * this.rowHeight + oldRowOffset
    return [x, newY]
  }

}
