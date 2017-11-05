
import { CollectionView, GridLayout } from '../../../dist'
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
}

window.onload = function () {
  const delegate = new Delegate([])
  const scrollElement = document.getElementById('scroll')
  const layout = new GridLayout()
  const view = new CollectionView(scrollElement, layout, delegate)
  const button = document.getElementById('button')
  button.onclick = function () {
    delegate.items = ["A", "B", "C"]
    view.changeIndices([], delegate.items.map((_, index) => index), new Map())
  }
}
