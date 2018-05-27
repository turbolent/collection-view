import {
  CollectionView,
  GridLayout,
  CollectionViewAnimationPhase,
  CollectionViewAnimationReason,
  Animation,
  Size,
  Insets
} from '../../../dist'
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
    const extra = 100
    const extraDuration = Math.random() * extra
    const baseDuration =
      reason === CollectionViewAnimationReason.ELEMENT_REMOVAL
        ? 300
        : 500
    const duration = baseDuration + extraDuration
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
        return {'transform': `translate3d(${x}px, ${y}px, -350px)`}
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
  const layout = new GridLayout({
    itemSize: new Size(140, 140),
    insets: new Insets(40, 40, 30, 30)
  })
  const view = new CollectionView(scrollElement, layout, delegate)

  const items = Array.from(Array(20).keys()).map((index) => index + 1)
  const indices = items.map((_, index) => index)

  let added = false

  const button = document.getElementById('button')
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
