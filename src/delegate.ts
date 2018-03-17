import CollectionView from './collection-view'

export default interface CollectionViewDelegate {
  getCount(): number

  configureElement(element: HTMLElement, index: number): void

  invalidateElement?(element: HTMLElement, index: number): void

  onScroll?(collectionView: CollectionView): void
}