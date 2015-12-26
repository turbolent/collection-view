import { CollectionView, ListLayout } from '../../../src'
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
    element.classList.add(style.row)
    element.textContent = this.items[index]
  }
}

window.onload = function () {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const delegate = new Delegate(items)
  const scrollElement = document.getElementById('scroll')
  const layout = new ListLayout()
  new CollectionView(scrollElement, layout, delegate)
}
