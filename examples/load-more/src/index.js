
import { CollectionView, GridLayout } from '../../../dist'
import style from '../../_common/style.css'
import './style.css'


class Delegate {

  constructor(items) {
    this.items = items
  }

  getCount() {
    return this.items.length
  }

  configureElement(element, index) {
    element.classList.add(style.box)
    element.textContent = this.items[index]
  }

  onScroll(view) {
    if (this.loadingMore)
      return

    const end = view.scrollPosition[1]
                + view.containerSize[1]
                + Delegate.LOAD_THRESHOLD
    if (end < view.contentSize[1])
      return

    this.loadingMore = true

    setTimeout(() => {
      this.addMore(view)
      this.loadingMore = false
    }, Delegate.DELAY)
  }

  addMore(view) {
    const current = this.getCount()
    const indices = []
    for (let i = current + 1; i <= current + 100; i += 1) {
      this.items.push(i)
      indices.push(i - 1)
    }

    view.changeIndices([], indices, {})
  }

}

Delegate.LOAD_THRESHOLD = 1000
Delegate.DELAY = 2000


window.onload = function () {
  const scrollElement = document.getElementById('scroll')
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const delegate = new Delegate(items)
  const layout = new GridLayout()
  layout.insets = [[20, 20], [20, 100]]
  new CollectionView(scrollElement, layout, delegate)
}
