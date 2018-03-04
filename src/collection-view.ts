import CollectionViewLayout from './layout'
import style from './style.css'
import { NumberTuple } from './types'
import { coalesce, sort, unique } from './utils'

import * as BezierEasing from 'bezier-easing'
import throttle from 'lodash-es/throttle'

const TRANSITION_END_EVENT = 'transitionend'

export interface CollectionViewDelegate {
  getCount(): number
  configureElement(element: HTMLElement, index: number): void
  invalidateElement?(element: HTMLElement, index: number): void
  onScroll?(collectionView: CollectionView): void
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
  readonly resizeThrottleDuration?: number
  readonly thresholds?: {
    readonly left?: number
    readonly top?: number
    readonly right?: number
    readonly bottom?: number
  }
}

class InvalidArgumentError extends Error {}

export default class CollectionView {
  private static readonly EASING = BezierEasing(0.25, 0.1, 0.25, 1.0)

  static readonly DEFAULT_THRESHOLD: number = 3000
  static readonly DEFAULT_REPOSITIONING_CLASS_NAME: string = 'repositioning'
  static readonly DEFAULT_APPEARING_CLASS_NAME: string= 'appearing'
  static readonly DEFAULT_DISAPPEARING_CLASS_NAME: string = 'disappearing'
  static readonly DEFAULT_ANIMATION_DURATION: number = 400
  static readonly DEFAULT_RESIZE_THROTTLE: number = 1000

  private _wantsResize: boolean = false
  private _resizing: boolean = false
  private _updating: boolean = false
  private _installed: boolean = true
  private _contentSize: NumberTuple = [0, 0]
  private _containerSize: NumberTuple = [0, 0]
  private _scrollPosition: NumberTuple = [0, 0]
  private _count: number = 0
  private _elements = new Map<number, HTMLElement>()
  private _visibleIndices: number[] = []
  private _onResize: () => void
  private _container: HTMLElement
  private _layout: CollectionViewLayout

  readonly content: HTMLElement
  readonly delegate: CollectionViewDelegate

  readonly animationDuration: number
  readonly repositioningClassName: string
  readonly appearingClassName: string
  readonly disappearingClassName: string
  readonly thresholds: CollectionViewThresholds
  readonly resizeThrottleDuration: number

  get scrollPosition(): NumberTuple {
    return this._scrollPosition
  }

  get layout(): CollectionViewLayout {
    return this._layout
  }

  get contentSize(): NumberTuple {
    return this._contentSize
  }

  get containerSize(): NumberTuple {
    return this._containerSize
  }

  constructor(content: HTMLElement,
              layout: CollectionViewLayout,
              delegate: CollectionViewDelegate,
              parameters: CollectionViewParameters = {}) {

    this.content = content
    content.classList.add(style.content)
    this._layout = layout
    this.delegate = delegate

    const container = content.parentElement
    if (container === null) {
      throw new InvalidArgumentError('Content element should be contained in a container element')
    }
    this._container = container as HTMLElement
    this._container.classList.add(style.container)

    this.animationDuration = coalesce(parameters.animationDuration,
                                      CollectionView.DEFAULT_ANIMATION_DURATION)
    this.repositioningClassName = coalesce(parameters.repositioningClassName,
                                           CollectionView.DEFAULT_REPOSITIONING_CLASS_NAME)
    this.appearingClassName = coalesce(parameters.appearingClassName,
                                       CollectionView.DEFAULT_APPEARING_CLASS_NAME)
    this.disappearingClassName = coalesce(parameters.disappearingClassName,
                                          CollectionView.DEFAULT_DISAPPEARING_CLASS_NAME)

    const thresholds = parameters.thresholds || {}
    this.thresholds = {
      left: coalesce(thresholds.left, CollectionView.DEFAULT_THRESHOLD),
      top: coalesce(thresholds.top, CollectionView.DEFAULT_THRESHOLD),
      right: coalesce(thresholds.right, CollectionView.DEFAULT_THRESHOLD),
      bottom: coalesce(thresholds.bottom, CollectionView.DEFAULT_THRESHOLD)
    }

    this.updateContainerSize(this._layout)
    this.updateCount()
    this.updateContentSize(this._layout)

    this.onScroll = this.onScroll.bind(this)

    this._onResize = throttle(() => this.resize(),
      coalesce(parameters.resizeThrottleDuration,
               CollectionView.DEFAULT_RESIZE_THROTTLE),
      {leading: false})

    this._container.addEventListener('scroll', this.onScroll, false)
    window.addEventListener('resize', this._onResize, false)

    // DEBUG: keep scroll position
    // let savedPos = localStorage['pos']
    // if (savedPos)
    //   this.scrollTo(JSON.parse(savedPos))
    // window.addEventListener("beforeunload", () => {
    //   localStorage['pos'] = JSON.stringify(this.scrollPosition)
    // })

    this.updateCurrentIndices()
  }

  public uninstall(elementHandler?: (element: HTMLElement) => void): void {
    this._installed = false

    this.content.classList.remove(style.content)
    this.content.removeAttribute('style')

    this._container.classList.remove(style.container)
    this._container.removeEventListener('scroll', this.onScroll, false)

    window.removeEventListener('resize', this._onResize, false)

    if (elementHandler) {
      this._elements.forEach((element) =>
                                 elementHandler(element))
    }

    this._elements.forEach((element) =>
                             this.removeElement(element))
  }

  private get currentContainerSize(): NumberTuple {
    return [
      this._container.clientWidth,
      this._container.clientHeight
    ]
  }

  private updateContainerSize(layout: CollectionViewLayout): void {
    this._containerSize = this.currentContainerSize
    if (layout.updateContainerSize) {
      layout.updateContainerSize(this._containerSize)
    }
  }

  private updateCount(): void {
    this._count = this.delegate.getCount()
  }

  private updateContentSize(layout: CollectionViewLayout): void {
    const containerSize = this.currentContainerSize
    this._contentSize = layout.getContentSize(this._count, containerSize)
    const [contentWidth, contentHeight] = this._contentSize
    this.content.style.minWidth = `${contentWidth}px`
    this.content.style.minHeight = `${contentHeight}px`
  }

  private get currentScrollPosition(): NumberTuple {
    return [
      this._container.scrollLeft,
      this._container.scrollTop
    ]
  }

  private onScroll(): void {
    this._scrollPosition = this.currentScrollPosition

    if (this._updating) {
      return
    }
    this._updating = true

    requestAnimationFrame(() => {
      this.updateCurrentIndices()
      if (this.delegate.onScroll) {
        this.delegate.onScroll(this)
      }
      this._updating = false
    })
  }

  private getAxisOffsets(position: number, range: number, startThreshold: number, endThreshold: number): NumberTuple {
    const offset = Math.max(0, position - startThreshold)
    const fullRange = startThreshold + range + endThreshold
    const endOffset = offset + fullRange
    return [offset, endOffset]
  }

  private getOffsets(position: NumberTuple): [NumberTuple, NumberTuple] {
    const [x, y] = position
    const [containerWidth, containerHeight] = this._containerSize
    const {left, top, right, bottom} = this.thresholds
    const xOffsets = this.getAxisOffsets(x, containerWidth, left, right)
    const yOffsets = this.getAxisOffsets(y, containerHeight, top, bottom)
    return [xOffsets, yOffsets]
  }

  private getIndices(layout: CollectionViewLayout, position: NumberTuple, containerSize: NumberTuple): number[] {
    const [xOffsets, yOffsets] = this.getOffsets(position)
    return layout.getIndices(xOffsets, yOffsets, this._count, containerSize)
  }

  private get currentIndices(): number[] {
    return this.getIndices(this._layout, this._scrollPosition, this._containerSize)
  }

  private updateCurrentIndices(): void {
    this.updateIndices(this.currentIndices)
  }

  // update elements when viewport changes (e.g. when scrolling)
  private updateIndices(newIndices: number[]): void {
    // determine old elements. save invalid elements so they can be reused
    const invalidElements: HTMLElement[] = []

    this._elements.forEach((element, index) => {
      if (newIndices.indexOf(index) >= 0) {
        return
      }

      this._elements.delete(index)
      if (this.delegate.invalidateElement) {
        this.delegate.invalidateElement(element, index)
      }

      invalidElements.push(element)
    })

    // add missing elements
    const currentIndices = this._visibleIndices
    newIndices.filter((index) => currentIndices.indexOf(index) < 0)
              .forEach((index) => {
                // reuse one of the invalid/old elements, or create a new element
                const element = invalidElements.pop()
                  || this.createAndAddElement()
                this.configureElement(this._layout, element, index)
                this.positionElement(this._layout, element, index)
                element.classList.remove(this.repositioningClassName)
                this._elements.set(index, element)
              })
    this._visibleIndices = newIndices

    // actually remove old elements, which weren't reused
    invalidElements.forEach((element) => {
      if (element == null) {
        return
      }
      this.removeElement(element)
    })
  }

  private configureElement(layout: CollectionViewLayout, element: HTMLElement, index: number): void {
    this.delegate.configureElement(element, index)
    layout.configureElement(element, index)
  }

  private positionElement(layout: CollectionViewLayout, element: HTMLElement, index: number): void {
    element.style.zIndex = `${index + 1}`
    const [x, y] = layout.getElementPosition(index).map(Math.round)
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  private createAndAddElement(): HTMLElement {
    const element = document.createElement('div')
    element.classList.add(style.element)
    this.content.appendChild(element)
    return element
  }

  private repositionVisibleElements(layout: CollectionViewLayout): void {

    this._elements.forEach((element, index) => {
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
    if (this._resizing) {
      this._wantsResize = true
      return
    }
    this._resizing = true

    this.updateLayout(this._layout)
      .then(() => {
        this._resizing = false

        if (this._wantsResize) {
          this._wantsResize = false
          this.resize()
        }
    })
  }

  public updateLayout(newLayout: CollectionViewLayout): Promise<void> {

    return new Promise(resolve => {

      this._container.removeEventListener('scroll', this.onScroll, false)

      // update with elements that will be visible after resize

      const newContainerSize = this.currentContainerSize
      const newPosition =
        newLayout.convertPositionInSize(this._scrollPosition, newContainerSize, this._layout)
      const futureIndices = this.getIndices(newLayout, newPosition, newContainerSize)
      const indices = unique(this._visibleIndices.concat(futureIndices))
      this.updateIndices(indices)

      // temporarily shift position of visible elements and scroll
      // to future position, so elements appear to "stay"

      const diffX = Math.round(newPosition[ 0 ] - this._scrollPosition[ 0 ])
      const diffY = Math.round(newPosition[ 1 ] - this._scrollPosition[ 1 ])

      if (diffX || diffY) {
        this._elements.forEach((element) =>
                                 element.style.transform += ` translate3d(${diffX}px, ${diffY}px, 0)`)
      }

      this.updateContentSize(newLayout)

      this.scrollTo(newPosition)

      this._scrollPosition = newPosition

      this.updateContainerSize(newLayout)

      // reposition (NOTE: setTimeout important)
      setTimeout(() => {

        this.repositionVisibleElements(newLayout)

        this._elements.forEach((element, index) =>
                                 newLayout.configureElement(element, index))

        this._layout = newLayout

        if (this._installed) {
          this._container.addEventListener('scroll', this.onScroll, false)
        }

        setTimeout(() => {
          this.updateIndices(futureIndices)

          resolve()
        }, this.animationDuration)
      }, 0)
    })
  }

  // TODO: OK to make this public?
  private scrollTo(position: NumberTuple): void {
    const [x, y] = position
    this._container.scrollLeft = x
    this._container.scrollTop = y
  }

  // TODO: OK to make this public?
  private animatedScrollTo(position: NumberTuple): void {
    const start = Date.now()
    const [fromX, fromY] = this.currentScrollPosition
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

  private removeElement(element: HTMLElement) {
    const parent = element.parentElement
    if (!parent) {
      return;
    }

    parent.removeChild(element)
  }

  public changeIndices(removedIndices: number[], addedIndices: number[], movedIndexMap: Map<number, number>): Promise<void> {
    return new Promise((resolve, reject) => {

      const promises: Promise<void>[] = []

      // handle legacy Object
      if (!(movedIndexMap instanceof Map)) {
        const movedIndexObject = movedIndexMap as { [key: string]: any }
        const pairs = Object.keys(movedIndexObject)
          .map((key): [number, number] =>
                 [Number(key), Number(movedIndexObject[key])])
        movedIndexMap = new Map<number, number>(pairs)
      }

      this._container.removeEventListener('scroll', this.onScroll, false)

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
        this.updateContentSize(this._layout)
      }

      // scroll if current position will be out of bounds

      const [newContentWidth, newContentHeight] =
        this._layout.getContentSize(this._count, this._containerSize)

      const [containerWidth, containerHeight] = this._containerSize
      const [scrollX, scrollY] = this._scrollPosition
      const right = scrollX + containerWidth
      const adjustX = right > newContentWidth
      if (adjustX) {
        this._scrollPosition[0] = Math.max(0, scrollX - (right - newContentWidth))
      }

      const bottom = scrollY + containerHeight
      const adjustY = bottom > newContentHeight
      if (adjustY) {
        this._scrollPosition[1] = Math.max(0, scrollY - (bottom - newContentHeight))
      }

      if (adjustX || adjustY) {
        this.animatedScrollTo(this._scrollPosition)
      }

      // disappear and remove elements

      removedIndices.forEach((index) => {
        const element = this._elements.get(index)
        if (!element) {
          return
        }

        element.classList.add(this.disappearingClassName)
        element.style.zIndex = '0'

        promises.push(new Promise<void>(resolve => {

          // NOTE: notify delegate about invalidation after element was removed
          // (animation finished), not immediately when stopping to keep track of it
          setTimeout(() => {
                       this.removeElement(element)
                       if (this.delegate.invalidateElement) {
                         this.delegate.invalidateElement(element, index)
                       }

                       resolve()
                     },
                     this.animationDuration)
        }))

        this._elements.delete(index)
      })

      // reorder visible elements

      const removedOrMovedIndices = sort(removedIndices.concat(oldMovedIndices))
      const addedOrMovedIndices = sort(addedIndices.concat(newMovedIndices))

      let removedOrMovedReorderOffset = 0
      const newElements = new Map<number, HTMLElement>()

      this._elements.forEach((element, index) => {
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
      this._elements = newElements

      // load visible elements

      const newIndices = this.currentIndices

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

        const existingElement = this._elements.get(index)
        if (existingElement) {
          return
        }

        const element = this.createAndAddElement()
        const isNew = addedIndices.indexOf(index) >= 0
        this.configureElement(this._layout, element, index)
        this.positionElement(this._layout, element, isNew ? index : oldIndex)
        if (isNew) {
          element.classList.add(this.appearingClassName)
          // TODO: trigger restyle in a more proper way
          // tslint:disable-next-line:no-unused-expression
          window.getComputedStyle(element).opacity
          element.classList.remove(this.appearingClassName)
        }
        this._elements.set(index, element)
      })

      this._visibleIndices = newIndices

      // reposition (NOTE: setTimeout important)

      promises.push(new Promise<void>(resolve => {

        setTimeout(() => {

          this.repositionVisibleElements(this._layout)

          if (this._installed) {
            this._container.addEventListener('scroll', this.onScroll, false)
          }

          setTimeout(() => {
            if (countDifference < 0) {
              this.updateContentSize(this._layout)
            }

            this.updateCurrentIndices()

            resolve()
          }, this.animationDuration)

        }, 0)
      }))

      Promise.all(promises)
        .then(() => resolve())
        .catch(e => reject(e))
    })
  }

}
