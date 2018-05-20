import { Position, Ranges, Size } from './types'

export default interface CollectionViewLayout {

  getContentSize(count: number, containerSize: Size): Size

  getIndices(ranges: Ranges,
             count: number,
             containerSize: Size): number[]

  getElementPosition(index: number): Position

  configureElement(element: HTMLElement, index: number): void

  convertPositionInSize(position: Position,
                        newContainerSize: Size,
                        oldLayout: CollectionViewLayout): Position

  updateContainerSize?(containerSize: Size): void

  // NOTE: the return type is not a generic type parameter, as the collection view
  // can not have a type parameter constraining it to a single layout
  getElementInfo(index: number): any
}
