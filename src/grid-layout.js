export default class GridLayout {

  static Direction = {
    VERTICAL: 0,
    HORIZONTAL: 1
  }

  constructor() {
    this.itemSize = [200, 200]
    this.spacing = [20, 20]
    this.insets = [[10, 10], [10, 10]]
    this.itemCount = 0
    this.containerSizeConstraint = 0
    this.direction = GridLayout.Direction.VERTICAL
  }

  getItemCount(containerSize) {
    const spacing = this.spacing[this.direction]
    const [startInset, endInset] = this.insets[this.direction]
    const availableSpace = containerSize[this.direction] - startInset - endInset
    const spaceAndSpacing = availableSpace + spacing
    const itemAndSpacing = this.itemSize[this.direction] + spacing
    return Math.floor(spaceAndSpacing / itemAndSpacing)
  }

  configureElement(element, _index) {
    const [width, height] = this.itemSize
    element.style.width = `${width}px`
    element.style.height = `${height}px`
  }

  updateContainerSize(containerSize) {
    this.containerSizeConstraint = containerSize[this.direction]
    this.itemCount = this.getItemCount(containerSize)
  }

  getIndices(xOffsets, yOffsets, count, containerSize) {
    const offsets = [xOffsets, yOffsets]
    const otherDirection = 1 - this.direction
    const [otherStartInset, otherEndInset] = this.insets[otherDirection]
    let [offset, endOffset] = offsets[otherDirection]
    offset -= otherStartInset
    endOffset -= otherEndInset
    const itemCount = this.getItemCount(containerSize)
    const spacing = this.spacing[otherDirection]
    const itemAndSpacing = this.itemSize[otherDirection] + spacing
    const startIndex = Math.max(0, Math.floor(offset / itemAndSpacing) * itemCount)
    const endIndex = Math.min(Math.ceil(endOffset / itemAndSpacing) * itemCount, count)
    const indices = []
    for (let i = startIndex; i < endIndex; i += 1)
      indices.push(i)
    return indices
  }

  getElementPosition(index) {
    const sectionIndex = Math.floor(index / this.itemCount)
    const itemIndex = index % this.itemCount
    const spacing = this.spacing[this.direction]
    const [startInset, endInset] = this.insets[this.direction]
    const otherDirection = 1 - this.direction
    const [otherStartInset] = this.insets[otherDirection]
    const itemAndSpacing = this.itemSize[this.direction] + spacing
    const availableSpace = this.containerSizeConstraint - startInset - endInset
    const diff = availableSpace + spacing - this.itemCount * itemAndSpacing
    const otherspacing = this.spacing[otherDirection]
    const otherItemAndspacing = this.itemSize[otherDirection] + otherspacing
    const result = []
    result[this.direction] = startInset + itemIndex * itemAndSpacing + Math.max(0, diff / 2)
    result[otherDirection] = otherStartInset + sectionIndex * otherItemAndspacing
    return result
  }

  getContentSize(count, containerSize) {
    const itemCount = this.getItemCount(containerSize)
    const sectionCount = Math.ceil(count / itemCount)
    const otherDirection = 1 - this.direction
    const [startInset, endInset] = this.insets[otherDirection]
    const spacing = this.spacing[otherDirection]
    const itemAndSpacing = this.itemSize[otherDirection] + spacing
    const space = startInset + sectionCount * itemAndSpacing + endInset
    const result = []
    result[this.direction] = containerSize[this.direction]
    result[otherDirection] = space
    return result
  }

  convertPositionInSize(position, newContainerSize, oldLayout) {
    const oldGridLayout = oldLayout instanceof GridLayout
                          ? oldLayout
                          : this
    const oldOtherDimension = 1 - oldGridLayout.direction
    const oldOtherPosition = position[oldOtherDimension]
    const oldOtherspacing = oldGridLayout.spacing[oldOtherDimension]
    const oldOtherItemAndSpacing = oldGridLayout.itemSize[oldOtherDimension] + oldOtherspacing
    const oldSectionIndex = Math.floor(oldOtherPosition / oldOtherItemAndSpacing)
    const oldItemIndex = oldSectionIndex * oldGridLayout.itemCount
    const oldItemOffset = oldOtherPosition % oldOtherItemAndSpacing

    const newItemCount = this.getItemCount(newContainerSize)
    const newSectionIndex = Math.floor(oldItemIndex / newItemCount)
    const newOtherDimension = 1 - this.direction
    const newOtherspacing = this.spacing[newOtherDimension]
    const newOtherItemAndSpacing = this.itemSize[newOtherDimension] + newOtherspacing
    const newOtherPosition = newSectionIndex * newOtherItemAndSpacing + oldItemOffset

    const result = []
    result[this.direction] = 0
    result[newOtherDimension] = newOtherPosition
    return result
  }
}
