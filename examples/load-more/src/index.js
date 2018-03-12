
import { CollectionView, GridLayout, Insets } from '../../../dist'
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

    const end = view.scrollPosition.y
                + view.containerSize.height
                + Delegate.LOAD_THRESHOLD

    if (end < view.contentSize.height)
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
  const layout = new GridLayout({
      insets: new Insets(20, 100, 20, 20)
  })
  new CollectionView(scrollElement, layout, delegate)
}
