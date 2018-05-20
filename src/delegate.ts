import CollectionView, { CollectionViewAnimationReason } from './collection-view'

export default interface CollectionViewDelegate {
  getCount(): number

  configureElement(element: HTMLElement, index: number): void

  invalidateElement?(element: HTMLElement, index: number): void

  onScroll?(collectionView: CollectionView): void

  getAnimationDuration?(index: number, info: any, property: string, reason: CollectionViewAnimationReason): number

  getAnimationDelay?(index: number, info: any, property: string, reason: CollectionViewAnimationReason): number
}