import CollectionViewLayout from './layout'
import style from './style.css'
import { NumberTuple } from './types'

import BezierEasing = require('bezier-easing')
import throttle from 'lodash-es/throttle'

const TRANSITION_END_EVENT = 'transitionend'

// TODO: move to separate file

function unique<T>(items: T[]): T[] {
  const seen = new Map<T, boolean>()
  return items.filter((item) => {
    if (seen.has(item)) {
      return false
    }
    seen.set(item, true)
    return true
  })
}

function sort(indices: number[]): number[] {
  return indices.sort((a, b) => a < b ? -1 : 1)
}

function coalesce<T>(value: T | undefined | null, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue
  }

  return value
}

export interface CollectionViewDelegate {
  getCount(): number
  onScroll?(collectionView: CollectionView): void
  configureElement(element: HTMLElement, index: number): void
}

export interface CollectionViewThresholds {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
}

export interface CollectionViewParameters {
  readonly animationDuration?: number
  readonly repositioningClassName?: string
  readonly appearingClassName?: string
  readonly disappearingClassName?: string
  readonly thresholds?: {
    readonly left?: number
    readonly top?: number
    readonly right?: number
    readonly bottom?: number
  }
}

export default class CollectionView {
  private static readonly EASING = BezierEasing(0.25, 0.1, 0.25, 1.0)

  static readonly DEFAULT_THRESHOLD: number = 3000
  static readonly DEFAULT_REPOSITIONING_CLASS_NAME: string = 'repositioning'
  static readonly DEFAULT_APPEARING_CLASS_NAME: string= 'appearing'
  static readonly DEFAULT_DISAPPEARING_CLASS_NAME: string = 'disappearing'
  static readonly DEFAULT_ANIMATION_DURATION: number = 400
  static readonly DEFAULT_RESIZE_THROTTLE: number = 1000

  private wantsResize: boolean = false
  private resizing: boolean = false
  private updating: boolean = false
  private installed: boolean = true
  private contentSize: NumberTuple = [0, 0]
  private containerSize: NumberTuple = [0, 0]
  // TODO: add getter
  private scrollPosition: NumberTuple = [0, 0]
  private count: number = 0
  private elements: Map<number, HTMLElement>
  private visibleIndices: number[] = []
  private onResize: () => void

  // TODO: add getter
  private delegate: CollectionViewDelegate
  // TODO: add getter
  private layout: CollectionViewLayout
  // TODO: add getter
  private content: HTMLElement
  private container: HTMLElement

  readonly animationDuration: number
  readonly repositioningClassName: string
  readonly appearingClassName: string
  readonly disappearingClassName: string
  readonly thresholds: CollectionViewThresholds

  constructor(content: HTMLElement,
              layout: CollectionViewLayout,
              delegate: CollectionViewDelegate,
              {
                animationDuration,
                repositioningClassName,
                appearingClassName,
                disappearingClassName,
                thresholds
              }: CollectionViewParameters = {}) {
    this.content = content
    content.classList.add(style.content)
    this.layout = layout
    this.delegate = delegate

    // TODO: assert not null
    const container = content.parentElement
    this.container = container as any as HTMLElement
    this.container.classList.add(style.container)

    this.animationDuration = coalesce(animationDuration,
                                      CollectionView.DEFAULT_ANIMATION_DURATION)
    this.repositioningClassName = coalesce(repositioningClassName,
                                           CollectionView.DEFAULT_REPOSITIONING_CLASS_NAME)
    this.appearingClassName = coalesce(appearingClassName,
                                       CollectionView.DEFAULT_APPEARING_CLASS_NAME)
    this.disappearingClassName = coalesce(disappearingClassName,
                                          CollectionView.DEFAULT_DISAPPEARING_CLASS_NAME)

    if (!thresholds) {
      thresholds = {}
    }
    this.thresholds = {
      left: coalesce(thresholds.left, CollectionView.DEFAULT_THRESHOLD),
      top: coalesce(thresholds.top, CollectionView.DEFAULT_THRESHOLD),
      right: coalesce(thresholds.right, CollectionView.DEFAULT_THRESHOLD),
      bottom: coalesce(thresholds.bottom, CollectionView.DEFAULT_THRESHOLD)
    }

    this.updateContainerSize(this.layout)
    this.updateCount()
    this.updateContentSize(this.layout)

    this.onScroll = this.onScroll.bind(this)
    // TODO: make resize throttle duration a parameter
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

  public uninstall(): void {
    this.installed = false

    this.content.classList.remove(style.content)
    this.content.removeAttribute('style')

    this.container.classList.remove(style.container)
    this.container.removeEventListener('scroll', this.onScroll, false)

    window.removeEventListener('resize', this.onResize, false)

    this.elements.forEach((element) => {
      const parent = element.parentElement
      if (parent) {
        parent.removeChild(element)
      }
    })
  }

  // TODO: make getter
  private getContainerSize(): NumberTuple {
    return [
      this.container.clientWidth,
      this.container.clientHeight
    ]
  }

  private updateContainerSize(layout: CollectionViewLayout): void {
    this.containerSize = this.getContainerSize()
    if (layout.updateContainerSize) {
      layout.updateContainerSize(this.containerSize)
    }
  }

  private updateCount(): void {
    this.count = this.delegate.getCount()
  }

  private updateContentSize(layout: CollectionViewLayout): void {
    const containerSize = this.getContainerSize()
    this.contentSize = layout.getContentSize(this.count, containerSize)
    const [contentWidth, contentHeight] = this.contentSize
    this.content.style.minWidth = `${contentWidth}px`
    this.content.style.minHeight = `${contentHeight}px`
  }

  // TODO: make getter
  private getScrollPosition(): NumberTuple {
    return [
      this.container.scrollLeft,
      this.container.scrollTop
    ]
  }

  private onScroll(): void {
    this.scrollPosition = this.getScrollPosition()

    if (this.updating) {
      return
    }
    this.updating = true

    requestAnimationFrame(() => {
      this.updateCurrentIndices()
      if (this.delegate.onScroll) {
        this.delegate.onScroll(this)
      }
      this.updating = false
    })
  }

  // TODO: make getter
  private getAxisOffsets(position: number, range: number, startThreshold: number, endThreshold: number): NumberTuple {
    const offset = Math.max(0, position - startThreshold)
    const fullRange = startThreshold + range + endThreshold
    const endOffset = offset + fullRange
    return [offset, endOffset]
  }

  // TODO: make getter
  private getOffsets(position: NumberTuple): [NumberTuple, NumberTuple] {
    const [x, y] = position
    const [containerWidth, containerHeight] = this.containerSize
    const {left, top, right, bottom} = this.thresholds
    const xOffsets = this.getAxisOffsets(x, containerWidth, left, right)
    const yOffsets = this.getAxisOffsets(y, containerHeight, top, bottom)
    return [xOffsets, yOffsets]
  }

  private getIndices(layout: CollectionViewLayout, position: NumberTuple, containerSize: NumberTuple): number[] {
    const [xOffsets, yOffsets] = this.getOffsets(position)
    return layout.getIndices(xOffsets, yOffsets, this.count, containerSize)
  }

  // TODO: make getter
  private getCurrentIndices(): number[] {
    return this.getIndices(this.layout, this.scrollPosition, this.containerSize)
  }

  private updateCurrentIndices(): void {
    this.updateIndices(this.getCurrentIndices())
  }

  private updateIndices(newIndices: number[]): void {
    // determine old elements
    const invalidElements: HTMLElement[] = []

    this.elements.forEach((element, index) => {
      if (newIndices.indexOf(index) >= 0) {
        return
      }

      this.elements.delete(index)
      invalidElements.push(element)
    })

    // add missing elements
    const currentIndices = this.visibleIndices
    newIndices.filter((index) => currentIndices.indexOf(index) < 0)
              .forEach((index) => {
                const element = invalidElements.pop()
                  || this.createAndAddElement()
                this.configureElement(this.layout, element, index)
                this.positionElement(this.layout, element, index)
                element.classList.remove(this.repositioningClassName)
                this.elements.set(index, element)
              })
    this.visibleIndices = newIndices

    // actually remove old elements, which weren't reused
    invalidElements.forEach((element) => {
      if (element == null) {
        return
      }
      const parent = element.parentElement
      if (parent) {
        parent.removeChild(element)
      }
    })
  }

  private configureElement(layout: CollectionViewLayout, element: HTMLElement, index: number): void {
    this.delegate.configureElement(element, index)
    layout.configureElement(element, index)
  }

  private positionElement(layout: CollectionViewLayout, element: HTMLElement, index: number): void {
    element.style.zIndex = `${index + 1}`
    const [x, y] = layout.getElementPosition(index)
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  private createAndAddElement(): HTMLElement {
    const element = document.createElement('div')
    element.classList.add(style.element)
    this.content.appendChild(element)
    return element
  }

  private repositionVisibleElements(layout: CollectionViewLayout): void {

    this.elements.forEach((element, index) => {
      const onTransitionEnd = () => {
        element.removeEventListener(TRANSITION_END_EVENT, onTransitionEnd, false)
        element.classList.remove(this.repositioningClassName)
      }

      element.addEventListener(TRANSITION_END_EVENT, onTransitionEnd, false)
      element.classList.add(this.repositioningClassName)

      this.positionElement(layout, element, index)
    })
  }

  private resize(): void {
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

  public updateLayout(newLayout: CollectionViewLayout, completion: () => void): void {

    this.container.removeEventListener('scroll', this.onScroll, false)

    // update with elements that will be visible after resize

    const newContainerSize = this.getContainerSize()
    const newPosition =
      newLayout.convertPositionInSize(this.scrollPosition, newContainerSize, this.layout)
    const futureIndices = this.getIndices(newLayout, newPosition, newContainerSize)
    const indices = unique(this.visibleIndices.concat(futureIndices))
    this.updateIndices(indices)

    // temporarily shift position of visible elements and scroll
    // to future position, so elements appear to "stay"

    const diffX = newPosition[0] - this.scrollPosition[0]
    const diffY = newPosition[1] - this.scrollPosition[1]

    if (diffX || diffY) {
      this.elements.forEach((element) =>
        element.style.transform += ` translate3d(${diffX}px, ${diffY}px, 0)`)
    }

    this.updateContentSize(newLayout)

    this.scrollTo(newPosition)

    this.scrollPosition = newPosition

    this.updateContainerSize(newLayout)

    // reposition (NOTE: setTimeout important)
    setTimeout(() => {

      this.repositionVisibleElements(newLayout)

      this.elements.forEach((element, index) =>
        newLayout.configureElement(element, index))

      this.layout = newLayout

      if (this.installed) {
        this.container.addEventListener('scroll', this.onScroll, false)
      }

      setTimeout(() => {
        if (completion) {
          completion()
        }
      }, this.animationDuration)
    }, 0)
  }

  // TODO: OK to make this public?
  private scrollTo(position: NumberTuple): void {
    const [x, y] = position
    this.container.scrollLeft = x
    this.container.scrollTop = y
  }

  // TODO: OK to make this public?
  private animatedScrollTo(position: NumberTuple): void {
    const start = Date.now()
    const [fromX, fromY] = this.getScrollPosition()
    const [toX, toY] = position
    const easing = CollectionView.EASING
    const scroll = () => {
      const now = Date.now()
      const progress = Math.min(1, (now - start) / this.animationDuration)
      const easedProgress = easing(progress)
      const targetX = fromX + easedProgress * (toX - fromX)
      const targetY = fromY + easedProgress * (toY - fromY)
      this.scrollTo([targetX, targetY])

      if (progress < 1) {
        requestAnimationFrame(scroll)
      }
    }

    requestAnimationFrame(scroll)
  }

  public changeIndices(removedIndices: number[], addedIndices: number[], movedIndexMap: Map<number, number>): void {

    this.container.removeEventListener('scroll', this.onScroll, false)

    // prepare moved mapping

    const oldMovedIndices = Array.from(movedIndexMap.keys())
    const reverseMovedIndexMap = new Map<number, number>()
    oldMovedIndices.forEach((oldIndex) => {
      // TODO: assert
      const newIndex = movedIndexMap.get(oldIndex) as number
      reverseMovedIndexMap.set(newIndex, oldIndex)
    })
    const newMovedIndices = Array.from(reverseMovedIndexMap.keys())

    // update count

    this.updateCount()

    const countDifference = addedIndices.length - removedIndices.length

    // TODO: assert countDifference == this.count - oldCount

    if (countDifference > 0) {
      this.updateContentSize(this.layout)
    }

    // scroll if current position will be out of bounds

    const [newContentWidth, newContentHeight] =
      this.layout.getContentSize(this.count, this.containerSize)

    const [containerWidth, containerHeight] = this.containerSize
    const [scrollX, scrollY] = this.scrollPosition
    const right = scrollX + containerWidth
    const adjustX = right > newContentWidth
    if (adjustX) {
      this.scrollPosition[0] = Math.max(0, scrollX - (right - newContentWidth))
    }

    const bottom = scrollY + containerHeight
    const adjustY = bottom > newContentHeight
    if (adjustY) {
      this.scrollPosition[1] = Math.max(0, scrollY - (bottom - newContentHeight))
    }

    if (adjustX || adjustY) {
      this.animatedScrollTo(this.scrollPosition)
    }

    // disappear and remove elements

    removedIndices.forEach((index) => {
      const element = this.elements.get(index)
      if (!element) {
        return
      }

      element.classList.add(this.disappearingClassName)
      element.style.zIndex = '0'
      setTimeout(() => {
          const parent = element.parentElement
          if (parent) {
            parent.removeChild(element)
          }
        }, this.animationDuration)
      this.elements.delete(index)
    })

    // reorder visible elements

    const removedOrMovedIndices = sort(removedIndices.concat(oldMovedIndices))
    const addedOrMovedIndices = sort(addedIndices.concat(newMovedIndices))

    let removedOrMovedReorderOffset = 0
    const newElements = new Map<number, HTMLElement>()

    this.elements.forEach((element, index) => {
      let newIndex: number
      const movedIndex = movedIndexMap.get(index)
      if (movedIndex !== undefined) {
        newIndex = movedIndex
      } else {
        while (removedOrMovedReorderOffset < removedOrMovedIndices.length
               && removedOrMovedIndices[removedOrMovedReorderOffset] <= index) {
          removedOrMovedReorderOffset += 1
        }

        let addedOrMovedReorderOffset = 0
        while (addedOrMovedReorderOffset < addedOrMovedIndices.length
               && (addedOrMovedIndices[addedOrMovedReorderOffset]
                   <= index - removedOrMovedReorderOffset + addedOrMovedReorderOffset)) {
          addedOrMovedReorderOffset += 1
        }

        newIndex = index - removedOrMovedReorderOffset + addedOrMovedReorderOffset
      }

      newElements.set(newIndex, element)
    })
    this.elements = newElements

    // load visible elements

    const newIndices = this.getCurrentIndices()

    let removedOrMovedLoadOffset = 0
    let addedOrMovedLoadOffset = 0

    newIndices.forEach((index) => {

      let oldIndex: number
      const reverseMovedIndex = reverseMovedIndexMap.get(index)
      if (reverseMovedIndex !== undefined) {
        oldIndex = reverseMovedIndex
      } else {
        while (addedOrMovedLoadOffset < addedOrMovedIndices.length
               && addedOrMovedIndices[addedOrMovedLoadOffset] <= index) {
          addedOrMovedLoadOffset += 1
        }

        while (removedOrMovedLoadOffset < removedOrMovedIndices.length
               && (removedOrMovedIndices[removedOrMovedLoadOffset]
                   <= index - addedOrMovedLoadOffset + removedOrMovedLoadOffset)) {
          removedOrMovedLoadOffset += 1
        }

        oldIndex = index - addedOrMovedLoadOffset + removedOrMovedLoadOffset
      }

      const existingElement = this.elements.get(index)
      if (existingElement) {
        return
      }

      const element = this.createAndAddElement()
      const isNew = addedIndices.indexOf(index) >= 0
      this.configureElement(this.layout, element, index)
      this.positionElement(this.layout, element, isNew ? index : oldIndex)
      if (isNew) {
        element.classList.add(this.appearingClassName)
        // TODO: trigger restyle in a more proper way
        // tslint:disable-next-line:no-unused-expression
        window.getComputedStyle(element).opacity
        element.classList.remove(this.appearingClassName)
      }
      this.elements.set(index, element)
    })

    this.visibleIndices = newIndices

    // reposition (NOTE: setTimeout important)

    setTimeout(() => {

      this.repositionVisibleElements(this.layout)

      if (this.installed) {
        this.container.addEventListener('scroll', this.onScroll, false)
      }

      setTimeout(() => {
        if (countDifference < 0) {
          this.updateContentSize(this.layout)
        }

      }, this.animationDuration)

    }, 0)
  }

}
