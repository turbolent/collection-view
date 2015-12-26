
import { CollectionView, GridLayout } from '../../../src'
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

function newLayout(large) {
  const layout = new GridLayout()
  layout.itemSize = large ? [260, 260] : [180, 180]
  return layout
}

window.onload = function () {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const delegate = new Delegate(items)
  const scrollElement = document.getElementById('scroll')
  let large = false
  const layout = newLayout(large)
  const view = new CollectionView(scrollElement, layout, delegate)
  const button = document.getElementById('button')
  button.onclick = function () {
    large = !large
    view.updateLayout(newLayout(large))
  }
}
