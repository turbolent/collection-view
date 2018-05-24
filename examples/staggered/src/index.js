
import { CollectionView, GridLayout, Animation, Size, Insets } from '../../../dist'
import style from '../../_common/style.css'


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

  getAnimation(index, info) {
    return new Animation(200, (info.row + info.column) * 70)
  }
}

window.onload = function () {

  const delegate = new Delegate([])
  const scrollElement = document.getElementById('scroll')
  const layout = new GridLayout({
    itemSize: new Size(140, 140),
    insets: new Insets(40, 40, 30, 30)
  })
  const view = new CollectionView(scrollElement, layout, delegate)

  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

  const indices = items.map((_, index) => index)

  const button = document.getElementById('button')
  let added = false

  button.onclick = function () {
    if (added) {
      delegate.items = []
      view.changeIndices(indices, [], {})
    } else {
      delegate.items = items
      view.changeIndices([], indices, {})
    }
    added = !added
  }
}
