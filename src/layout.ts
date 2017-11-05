import { NumberTuple } from './types'

export default interface CollectionViewLayout {
  getContentSize(count: number, containerSize: NumberTuple): NumberTuple
  getIndices(xOffsets: NumberTuple, yOffsets: NumberTuple, count: number, containerSize: NumberTuple): number[]  
  getElementPosition(index: number): NumberTuple
  configureElement(element: HTMLElement, index: number): void
  convertPositionInSize(position: NumberTuple, newContainerSize: NumberTuple, oldLayout: CollectionViewLayout): NumberTuple
  updateContainerSize?(containerSize: NumberTuple): void
}
