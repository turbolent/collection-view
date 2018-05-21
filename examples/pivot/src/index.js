
import { CollectionView, GridLayout, CollectionViewAnimationPhase, CollectionViewAnimationReason, Animation } from '../../../dist'
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

  getAnimation(index, info, property, reason) {
    const extra = 200
    const extraDuration = Math.random() * extra
    const duration = 300 + extraDuration
    const delay = extra - extraDuration
    let timingFunction
    switch (reason) {
        case CollectionViewAnimationReason.ELEMENT_ADDITION:
            timingFunction = 'cubic-bezier(0.0, 0.0, 0.2, 1)'
            break
        case CollectionViewAnimationReason.ELEMENT_REMOVAL:
            timingFunction = 'cubic-bezier(0.4, 0.0, 1, 1)'
            break
        case CollectionViewAnimationReason.ELEMENT_MOVE:
        case CollectionViewAnimationReason.LAYOUT_UPDATE:
            timingFunction = 'cubic-bezier(0.4, 0.0, 0.2, 1)'
    }
    return new Animation(duration, delay, timingFunction)
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
