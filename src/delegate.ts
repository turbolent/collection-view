import CollectionView, { CollectionViewAnimationPhase, CollectionViewAnimationReason } from './collection-view'
import { Position } from './types'
import { Style } from './utils'

export default interface CollectionViewDelegate {

  getCount(): number

  configureElement(element: HTMLElement, index: number): void

  invalidateElement?(element: HTMLElement, index: number): void

  onScroll?(collectionView: CollectionView): void

  getAnimationDuration?(index: number, info: any, property: string, reason: CollectionViewAnimationReason): number

  getAnimationDelay?(index: number, info: any, property: string, reason: CollectionViewAnimationReason): number

  getStyle?(index: number, phase: CollectionViewAnimationPhase, info: any, position: Position): Style
}