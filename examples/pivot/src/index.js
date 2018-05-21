
import { CollectionView, GridLayout, CollectionViewAnimationPhase } from '../../../dist'
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

  getAnimationDuration() {
    return 300
  }

  getAnimationDelay(index, info) {
    return Math.random() * 100
  }

  getStyle(index, phase, info, position) {
      const {x, y} = position
      switch (phase) {
          case CollectionViewAnimationPhase.ELEMENT_APPEARING:
              return {'transform': `translate3d(${x}px, ${y}px, -300px)`}
          case CollectionViewAnimationPhase.ELEMENT_APPEARED:
              return {'transform': `translate3d(${x}px, ${y}px, 0)`}
          case CollectionViewAnimationPhase.ELEMENT_DISAPPEARED:
              return {'transform': `translate3d(${x}px, ${y}px, 150px)`}
      }
  }
}

window.onload = function () {

  const delegate = new Delegate([])
  const scrollElement = document.getElementById('scroll')
  const layout = new GridLayout()
  const view = new CollectionView(scrollElement, layout, delegate)


  const button = document.getElementById('button')

  let added = false

  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const indices = items.map((_, index) => index)

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
