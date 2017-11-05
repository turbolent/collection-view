import { CollectionView, ListLayout } from '../../../dist'
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
  const count = 100
  const items = new Array(count)
  for (let i = 0; i < count; i++)
    items[i] = `${i + 1}`;

  const delegate = new Delegate(items)
  const scrollElement = document.getElementById('scroll')
  const layout = new ListLayout()
  new CollectionView(scrollElement, layout, delegate)
}
