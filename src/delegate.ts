import CollectionView, { CollectionViewAnimationPhase, CollectionViewAnimationReason } from './collection-view'
import { Animation, Position } from './types'
import { Style } from './utils'

export default interface CollectionViewDelegate {

  getCount(): number

  configureElement(element: HTMLElement, index: number): void

  invalidateElement?(element: HTMLElement, index: number): void

  onScroll?(collectionView: CollectionView): void

  getAnimation?(index: number, info: any, property: string, reason: CollectionViewAnimationReason): Animation

  getStyle?(index: number, phase: CollectionViewAnimationPhase, info: any, position: Position): Style
}
