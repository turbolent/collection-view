
import { CollectionView, GridLayout, Size } from '../../../dist'
import style from './style.css'


class Delegate {

  constructor() {
    this.items = []
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
  window.wrapperElement = document.getElementById('wrapper')
  const scrollElement = document.getElementById('scroll')
  window.delegate = new Delegate()
  window.layout = new GridLayout()
  window.collectionView = new CollectionView(scrollElement, window.layout, window.delegate, {
    thresholds: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    }
  })
  window.newGridLayout = (params) => new GridLayout(params)
  window.Size = Size
}
