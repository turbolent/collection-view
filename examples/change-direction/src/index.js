
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
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const delegate = new Delegate(items)
  const scrollElement = document.getElementById('scroll')
  const layout = new GridLayout()
  const view = new CollectionView(scrollElement, layout, delegate)
  const button = document.getElementById('button')
  button.onclick = function () {
    const newLayout = new GridLayout()
    newLayout.direction = 1 - view.layout.direction
    view.updateLayout(newLayout)
  }
}
