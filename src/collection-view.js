import BezierEasing from 'bezier-easing'
import throttle from 'lodash.throttle'
import { requestAnimFrame, transitionEndEventName } from './polyfills'
import style from './style.css'


export default class CollectionView {

  static THRESHOLD_PROPERTIES = ['left', 'top', 'right', 'bottom']
  static DEFAULT_THRESHOLD = 3000
  static DEFAULT_REPOSITIONING_CLASS_NAME = 'repositioning'
  static DEFAULT_APPEARING_CLASS_NAME = 'appearing'
  static DEFAULT_DISAPPEARING_CLASS_NAME = 'disappearing'
  static DEFAULT_ANIMATION_DURATION = 400
  static DEFAULT_RESIZE_THROTTLE = 1000

  constructor(scrollElement, layout, delegate) {
    this.scrollElement = scrollElement
    scrollElement.classList.add(style.content)
    this.layout = layout
    this.delegate = delegate
    this.container = scrollElement.parentElement
    this.container.classList.add(style.container)
    this.scrollPosition = [0, 0]
    this.containerSize = [0, 0]
    this.contentSize = [0, 0]
    this.elements = {}
    this.updating = false
    this.resizing = false
    this.visibleIndices = []
    this.animationDuration = CollectionView.DEFAULT_ANIMATION_DURATION
    this.thresholds = {}
    const defaultThreshold = CollectionView.DEFAULT_THRESHOLD
    CollectionView.THRESHOLD_PROPERTIES.forEach(property =>
      this.thresholds[property] = defaultThreshold)
    this.repositioningClassName = CollectionView.DEFAULT_REPOSITIONING_CLASS_NAME
    this.appearingClassName = CollectionView.DEFAULT_APPEARING_CLASS_NAME
    this.disappearingClassName = CollectionView.DEFAULT_DISAPPEARING_CLASS_NAME

    this.updateContainerSize(this.layout)
    this.updateCount()
    this.updateContentSize(this.layout)

    this.onScroll = this.onScroll.bind(this)
    this.onResize = throttle(() => this.resize(),
      CollectionView.DEFAULT_RESIZE_THROTTLE,
      {leading: false})

    this.container.addEventListener('scroll', this.onScroll, false)
    window.addEventListener('resize', this.onResize, false)

    // DEBUG: keep scroll position
    // let savedPos = localStorage['pos']
    // if (savedPos)
    //   this.scrollTo(JSON.parse(savedPos))
    // window.addEventListener("beforeunload", () => {
    //   localStorage['pos'] = JSON.stringify(this.scrollPosition)
    // })

    this.updateCurrentIndices()
  }

  getContainerSize() {
    return [this.container.clientWidth,
             this.container.clientHeight]
  }

  updateContainerSize(layout) {
    this.containerSize = this.getContainerSize()
    layout.updateContainerSize(this.containerSize)
  }

  updateCount() {
    this.count = this.delegate.getCount()
  }

  updateContentSize(layout) {
    this.contentSize = layout.getContentSize(this.count, this.getContainerSize())
    const [contentWidth, contentHeight] = this.contentSize
    this.scrollElement.style.minWidth = contentWidth + 'px'
    this.scrollElement.style.minHeight = contentHeight + 'px'
  }

  getScrollPosition() {
    return [this.container.scrollLeft,
            this.container.scrollTop]
  }

  onScroll() {
    this.scrollPosition = this.getScrollPosition()

    if (this.updating)
      return
    this.updating = true
    requestAnimFrame(() => {
      this.updateCurrentIndices()
      if (this.delegate.onScroll)
        this.delegate.onScroll(this)
      this.updating = false
    })
  }

  getAxisOffsets(position, range, startThreshold, endThreshold) {
    const offset = Math.max(0, position - startThreshold)
    const fullRange = startThreshold + range + endThreshold
    const endOffset = offset + fullRange
    return [offset, endOffset]
  }

  getOffsets(position) {
    const [x, y] = position
    const [containerWidth, containerHeight] = this.containerSize
    const {left, top, right, bottom} = this.thresholds
    const xOffsets = this.getAxisOffsets(x, containerWidth, left, right)
    const yOffsets = this.getAxisOffsets(y, containerHeight, top, bottom)
    return [xOffsets, yOffsets]
  }

  getIndices(layout, position, containerSize) {
    const [xOffsets, yOffsets] = this.getOffsets(position)
    return layout.getIndices(xOffsets, yOffsets, this.count, containerSize)
  }

  getCurrentIndices() {
    return this.getIndices(this.layout, this.scrollPosition, this.containerSize)
  }

  updateCurrentIndices() {
    this.updateIndices(this.getCurrentIndices())
  }

  forEachVisibleElement(fn) {
    this.keysAsNumbers(this.elements).forEach(index => {
      const element = this.elements[index]
      fn(element, index)
    })
  }

  updateIndices(newIndices) {
    // determine old elements
    const invalidElements = []

    this.forEachVisibleElement((element, index) => {
      if (newIndices.indexOf(index) >= 0)
        return

      delete this.elements[index]
      invalidElements.push(element)
    })

    // add missing elements
    const currentIndices = this.visibleIndices
    newIndices.filter(index => currentIndices.indexOf(index) < 0)
              .forEach(index => {
                const element = invalidElements.pop()
                  || this.createAndAddElement()
                this.configureElement(this.layout, element, index)
                this.positionElement(this.layout, element, index)
                element.classList.remove(this.repositioningClassName)
                this.elements[index] = element
              })
    this.visibleIndices = newIndices

    // actually remove old elements, which weren't reused
    invalidElements.forEach(element =>
      element.parentElement.removeChild(element))
  }

  configureElement(layout, element, index) {
    this.delegate.configureElement(element, index)
    layout.configureElement(element, index)
  }

  positionElement(layout, element, index) {
    element.style.zIndex = index + 1
    const [x, y] = layout.getElementPosition(index)
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  createAndAddElement() {
    const element = document.createElement('div')
    element.classList.add(style.element)
    this.scrollElement.appendChild(element)
    return element
  }

  unique(items) {
    const seen = {}
    return items.filter(item => {
      if (seen.hasOwnProperty(item))
        return false
      return (seen[item] = true)
    })
  }

  repositionVisibleElements(layout) {

    this.forEachVisibleElement((element, index) => {
      const onTransitionEnd = () => {
        element.removeEventListener(transitionEndEventName, onTransitionEnd, false)
        element.classList.remove(this.repositioningClassName)
      }

      element.addEventListener(transitionEndEventName, onTransitionEnd, false)
      element.classList.add(this.repositioningClassName)

      this.positionElement(layout, element, index)
    })
  }

  resize() {
    if (this.resizing) {
      this.wantsResize = true
      return
    }
    this.resizing = true

    this.updateLayout(this.layout, () => {
      this.resizing = false

      if (this.wantsResize) {
        this.wantsResize = false
        this.resize()
      }
    })
  }

  updateLayout(newLayout, completion) {

    this.container.removeEventListener('scroll', this.onScroll, false)

    // update with elements that will be visible after resize

    const newContainerSize = this.getContainerSize()
    const newPosition =
      newLayout.convertPositionInSize(this.scrollPosition, newContainerSize, this.layout)
    const futureIndices = this.getIndices(newLayout, newPosition, newContainerSize)
    const indices = this.unique(this.visibleIndices.concat(futureIndices))
    this.updateIndices(indices)


    // temporarily shift position of visible elements and scroll
    // to future position, so elements appear to "stay"

    const diffX = newPosition[0] - this.scrollPosition[0]
    const diffY = newPosition[1] - this.scrollPosition[1]

    if (diffX || diffY) {
      Object.values(this.elements).forEach(element =>
        element.style.transform += ` translate3d(${diffX}px, ${diffY}px, 0)`)
    }

    this.updateContentSize(newLayout)

    this.scrollTo(newPosition)

    this.scrollPosition = newPosition

    this.updateContainerSize(newLayout)

    // reposition (NOTE: setTimeout important)
    setTimeout(() => {

      this.repositionVisibleElements(newLayout)

      this.forEachVisibleElement((element, index) =>
        newLayout.configureElement(element, index))

      this.layout = newLayout

      this.container.addEventListener('scroll', this.onScroll, false)

      setTimeout(() => {
        if (completion)
          completion()
      }, this.animationDuration)
    }, 0)
  }

  scrollTo(position) {
    const [x, y] = position
    this.container.scrollLeft = x
    this.container.scrollTop = y
  }

  animatedScrollTo(position) {
    const start = Date.now()
    const [fromX, fromY] = this.getScrollPosition()
    const [toX, toY] = position
    const scroll = () => {
      const now = Date.now()
      const progress = Math.min(1, (now - start) / this.animationDuration)
      const easedProgress = BezierEasing.ease.get(progress)
      const targetX = fromX + easedProgress * (toX - fromX)
      const targetY = fromY + easedProgress * (toY - fromY)
      this.scrollTo([targetX, targetY])

      if (progress < 1)
        requestAnimFrame(scroll)
    }

    requestAnimFrame(scroll)
  }

  sort(indices) {
    return indices.sort((a, b) => { return a < b ? -1 : 1 })
  }

  keysAsNumbers(map) {
    return Object.keys(map).map(Number)
  }

  changeIndices(removedIndices, addedIndices, movedIndexMap) {

    this.container.removeEventListener('scroll', this.onScroll, false)

    // prepare moved mapping

    const oldMovedIndices = this.keysAsNumbers(movedIndexMap)
    const reverseMovedIndexMap = {}
    oldMovedIndices.forEach(oldIndex => {
      const newIndex = movedIndexMap[oldIndex]
      reverseMovedIndexMap[newIndex] = oldIndex
    })
    const newMovedIndices = this.keysAsNumbers(reverseMovedIndexMap)

    // update count

    this.updateCount()

    const countDifference = addedIndices.length - removedIndices.length

    // TODO: assert countDifference == this.count - oldCount

    if (countDifference > 0)
      this.updateContentSize(this.layout)


    // scroll if current position will be out of bounds

    const [newContentWidth, newContentHeight] =
      this.layout.getContentSize(this.count, this.containerSize)

    const [containerWidth, containerHeight] = this.containerSize
    const right = this.scrollPosition[0] + containerWidth
    const adjustX = right > newContentWidth
    if (adjustX)
      this.scrollPosition[0] -= right - newContentWidth

    const bottom = this.scrollPosition[1] + containerHeight
    const adjustY = bottom > newContentHeight
    if (adjustY)
      this.scrollPosition[1] -= bottom - newContentHeight

    if (adjustX || adjustY)
      this.animatedScrollTo(this.scrollPosition)


    // disappear and remove elements

    removedIndices.forEach(index => {
      const element = this.elements[index]
      if (!element)
        return

      element.classList.add(this.disappearingClassName)
      element.style.zIndex = 0
      setTimeout(() =>
          element.parentElement.removeChild(element),
        this.animationDuration)
      delete this.elements[index]
    })


    // reorder visible elements

    const removedOrMovedIndices = this.sort(removedIndices.concat(oldMovedIndices))
    const addedOrMovedIndices = this.sort(addedIndices.concat(newMovedIndices))

    let removedOrMovedReorderOffset = 0
    const newElements = {}

    this.forEachVisibleElement((element, index) => {
      let newIndex
      if (movedIndexMap.hasOwnProperty(index)) {
        newIndex = movedIndexMap[index]
      } else {
        while (removedOrMovedReorderOffset < removedOrMovedIndices.length
               && removedOrMovedIndices[removedOrMovedReorderOffset] <= index)
        {
          removedOrMovedReorderOffset += 1
        }

        let addedOrMovedReorderOffset = 0
        while (addedOrMovedReorderOffset < addedOrMovedIndices.length
               && (addedOrMovedIndices[addedOrMovedReorderOffset]
                   <= index - removedOrMovedReorderOffset + addedOrMovedReorderOffset))
        {
          addedOrMovedReorderOffset += 1
        }

        newIndex = index - removedOrMovedReorderOffset + addedOrMovedReorderOffset
      }

      newElements[newIndex] = element
    })
    this.elements = newElements


    // load visible elements

    const newIndices = this.getCurrentIndices()

    let removedOrMovedLoadOffset = 0
    let addedOrMovedLoadOffset = 0

    newIndices.forEach(index => {

      let oldIndex
      if (reverseMovedIndexMap.hasOwnProperty(index)) {
        oldIndex = reverseMovedIndexMap[index]
      } else {
        while (addedOrMovedLoadOffset < addedOrMovedIndices.length
               && addedOrMovedIndices[addedOrMovedLoadOffset] <= index)
        {
          addedOrMovedLoadOffset += 1
        }

        while (removedOrMovedLoadOffset < removedOrMovedIndices.length
               && (removedOrMovedIndices[removedOrMovedLoadOffset]
                   <= index - addedOrMovedLoadOffset + removedOrMovedLoadOffset))
        {
          removedOrMovedLoadOffset += 1
        }

        oldIndex = index - addedOrMovedLoadOffset + removedOrMovedLoadOffset
      }

      const existingElement = this.elements[index]
      if (existingElement)
        return

      const element = this.createAndAddElement()
      const isNew = addedIndices.indexOf(index) >= 0
      this.configureElement(this.layout, element, index)
      this.positionElement(this.layout, element, isNew ? index : oldIndex)
      if (isNew) {
        element.classList.add(this.appearingClassName)
        window.getComputedStyle(element).opacity
        element.classList.remove(this.appearingClassName)
      }
      this.elements[index] = element
    })

    this.visibleIndices = newIndices


    // reposition (NOTE: setTimeout important)

    setTimeout(() => {

      this.repositionVisibleElements(this.layout)

      this.container.addEventListener('scroll', this.onScroll, false)

      setTimeout(() => {
        if (countDifference < 0)
          this.updateContentSize(this.layout)

      }, this.animationDuration)

    }, 0)
  }

}
