import CollectionViewLayout from './layout'
import style from './style.css'
import { Animation, Line, Position, Range, Ranges, Required, Size } from './types'
import { assert, coalesce, intersect, range, sort, Style, unique } from './utils'
import * as BezierEasing from 'bezier-easing'
import throttle from 'lodash-es/throttle'
import CollectionViewDelegate from './delegate'

export interface CollectionViewThresholds {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface CollectionViewParameters {
  readonly animationDuration?: number
  readonly resizeThrottleDuration?: number
  readonly thresholds?: {
    readonly left?: number
    readonly top?: number
    readonly right?: number
    readonly bottom?: number
  }
  readonly positionImprovementOffset?: number
}

export enum CollectionViewAnimationReason {
  ELEMENT_ADDITION,
  ELEMENT_REMOVAL,
  ELEMENT_MOVE,
  LAYOUT_UPDATE
}

export enum CollectionViewAnimationPhase {
  ELEMENT_APPEARING,
  ELEMENT_APPEARED,
  ELEMENT_DISAPPEARED
}

class InvalidArgumentError extends Error {}

type Rejection = (reason?: any) => void

class Operation {

  private readonly rejections: Rejection[] = []

  constructor(reject: Rejection) {
    this.addRejection(reject)
  }

  addRejection(reject: Rejection) {
    this.rejections.push(reject)
  }

  reject() {
    this.rejections.forEach(rejection => rejection())
  }
}

export default class CollectionView {
  private static readonly SCROLL_EASING = BezierEasing(0.25, 0.1, 0.25, 1.0)

  static readonly DEFAULT_THRESHOLD: number = 3000
  static readonly DEFAULT_ANIMATION_DURATION: number = 400
  static readonly DEFAULT_RESIZE_THROTTLE: number = 1000
  static readonly DEFAULT_POSITION_IMPROVEMENT_OFFSET: number = 100

  private static readonly DEFAULT_TRANSITION_PROPERTIES = ['width', 'height', 'opacity']

  private _wantsResize: boolean = false
  private _resizing: boolean = false
  private _updating: boolean = false
  private _installed: boolean = true
  private _contentSize: Size = new Size(0, 0)
  private _containerSize: Size = new Size(0, 0)
  private _scrollPosition: Position = new Position(0, 0)
  private _count: number = 0
  private _elements = new Map<number, HTMLElement>()
  private _positions = new WeakMap<HTMLElement, Position>()
  private _visibleIndices: number[] = []
  private _onResize: () => void
  private _container: HTMLElement
  private _layout: CollectionViewLayout
  private _currentOperation?: Operation
  private _defaultAnimation: Animation

  readonly content: HTMLElement
  readonly delegate: CollectionViewDelegate

  readonly animationDuration: number
  readonly thresholds: CollectionViewThresholds
  readonly resizeThrottleDuration: number
  readonly positionImprovementOffset: number

  get scrollPosition(): Position {
    return this._scrollPosition
  }

  get layout(): CollectionViewLayout {
    return this._layout
  }

  get contentSize(): Size {
    return this._contentSize
  }

  get containerSize(): Size {
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

    this._defaultAnimation = new Animation(this.animationDuration, 0, "initial")

    const thresholds = parameters.thresholds || {}
    this.thresholds = {
      left: coalesce(thresholds.left, CollectionView.DEFAULT_THRESHOLD),
      top: coalesce(thresholds.top, CollectionView.DEFAULT_THRESHOLD),
      right: coalesce(thresholds.right, CollectionView.DEFAULT_THRESHOLD),
      bottom: coalesce(thresholds.bottom, CollectionView.DEFAULT_THRESHOLD)
    }

    this.positionImprovementOffset = coalesce(parameters.positionImprovementOffset,
                                              CollectionView.DEFAULT_POSITION_IMPROVEMENT_OFFSET)

    this.updateContainerSize(this._layout)
    this.updateCount()
    this.updateContentSize(this._layout)

    this.onScroll = this.onScroll.bind(this)

    this._onResize = throttle(() => this.resize(),
                              coalesce(parameters.resizeThrottleDuration,
                                       CollectionView.DEFAULT_RESIZE_THROTTLE),
                              {leading: false})

    this.addScrollListener()

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
      this._elements.forEach(element =>
                               elementHandler(element))
    }

    this._elements.forEach(element => this.removeFromParent(element))
  }

  private get currentContainerSize(): Size {
    return new Size(this._container.clientWidth,
                    this._container.clientHeight)
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
    const {width, height} = this._contentSize
    this.content.style.minWidth = `${width}px`
    this.content.style.minHeight = `${height}px`
  }

  private get currentScrollPosition(): Position {
    return new Position(this._container.scrollLeft,
                        this._container.scrollTop)
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

  private getAxisRange(position: number, range: number, startThreshold: number, endThreshold: number): Range {
    const offset = Math.max(0, position - startThreshold)
    const fullRange = startThreshold + range + endThreshold
    const endOffset = offset + fullRange
    return new Range(offset, endOffset)
  }

  private getXRange({x}: Position): Range {
    const {width} = this._containerSize
    const {left, right} = this.thresholds
    return this.getAxisRange(x, width, left, right)
  }

  private getYRange({y}: Position): Range {
    const {height} = this._containerSize
    const {top, bottom} = this.thresholds
    return this.getAxisRange(y, height, top, bottom)
  }

  private getIndices(layout: CollectionViewLayout, position: Position, containerSize: Size): number[] {
    const xRange = this.getXRange(position)
    const yRange = this.getYRange(position)
    return layout.getIndices(new Ranges(xRange, yRange),
                             this._count, containerSize)
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
      assert(() => index >= 0)

      if (newIndices.indexOf(index) >= 0) {
        return
      }

      this._elements.delete(index)
      this._positions.delete(element)

      if (this.delegate.invalidateElement) {
        this.delegate.invalidateElement(element, index)
      }

      invalidElements.push(element)
    })

    // add missing elements
    const currentIndices = this._visibleIndices
    newIndices.filter(index => currentIndices.indexOf(index) < 0)
      .forEach(index => {
        // reuse one of the invalid/old elements, or create a new element
        const element = invalidElements.pop()
                        || this.createAndAddElement()
        this.configureElement(this._layout, element, index)
        this.getAndApplyElementPosition(this._layout, element, index)

        // TODO: this.configureElementTransitionProperties(element) ?

        assert(() => index >= 0)
        this._elements.set(index, element)
      })
    this._visibleIndices = newIndices

    // actually remove old elements, which weren't reused
    invalidElements.forEach(element => {
      if (element == null) {
        return
      }
      this.removeFromParent(element)
    })
  }

  private configureElement(layout: CollectionViewLayout, element: HTMLElement, index: number): void {
    this.delegate.configureElement(element, index)
    layout.configureElement(element, index)
  }

  private getElementPosition(layout: CollectionViewLayout, index: number): Position {
    const position = layout.getElementPosition(index)
    return position.map(Math.round)
  }

  private applyElementPosition(element: HTMLElement, position: Position, index: number): void {
    const {x, y} = position
    element.style.zIndex = `${index + 1}`
    element.style.transform = `translate3d(${x}px, ${y}px, 0)`
    this._positions.set(element, position)
  }

  private getAndApplyElementPosition(layout: CollectionViewLayout, element: HTMLElement, index: number): void {
    const position = this.getElementPosition(layout, index)
    this.applyElementPosition(element, position, index)
  }

  private createAndAddElement(): HTMLElement {
    const element = document.createElement('div')
    element.classList.add(style.element)

    this.configureElementTransitionProperties(element)

    this.content.appendChild(element)
    return element
  }

  // TODO: assumes sizes are constant
  private repositionVisibleElements(layout: CollectionViewLayout,
                                    improvePositions: boolean,
                                    operation: Operation,
                                    animationReason?: CollectionViewAnimationReason): Promise<void> {

    return new Promise<void>((resolve, reject) => {

      const promises: Promise<void>[] = []

      this._elements.forEach((element, elementIndex) => {
        assert(() => elementIndex >= 0)

        const finalPosition = this.getElementPosition(layout, elementIndex)
        const currentPosition = this._positions.get(element)

        if (!currentPosition) {
          throw Error("missing position for element: " + element)
        }

        if (finalPosition.equals(currentPosition)) {
          return
        }

        const size = new Size(element.offsetWidth,
                              element.offsetHeight)

        const improvedPositions = improvePositions
          ? this.getImprovedPositions(currentPosition, finalPosition, size)
          : undefined

        if (improvedPositions !== undefined) {
          const improvedStartPosition = improvedPositions[0]
          if (improvedStartPosition !== undefined) {
            this.applyElementPosition(element, improvedStartPosition, elementIndex)
            element.getBoundingClientRect()
          }
        }

        let improvedEndPosition: Position | undefined
        if (improvedPositions !== undefined) {
          improvedEndPosition = improvedPositions[1]
        }

        let maxElementTransitionDuration = 0
        if (animationReason) {
          maxElementTransitionDuration =
            this.performTransition(elementIndex,
                                   element,
                                   ['transform'],
                                   animationReason)
        }

        // TODO: invoke onTransitionEnd right away if maxElementTransitionDuration == 0, as it won't be called otherwise?

        const temporaryEndPosition = improvedEndPosition !== undefined
          ? improvedEndPosition
          : finalPosition
        this.applyElementPosition(element, temporaryEndPosition, elementIndex)

        promises.push(new Promise<void>((resolve, reject) => {

          operation.addRejection(reject)

          this.delayForOperation(operation, () => {
            this.configureElementTransitionProperties(element)

            // TODO: also configureElementTransitionDurations and configureElementTransitionDelays ?

            if (improvedEndPosition !== undefined) {
              this.applyElementPosition(element, finalPosition, elementIndex)
            }

            resolve()
          }, maxElementTransitionDuration)
        }))

      })

      Promise.all(promises)
        .then(() => resolve(), reject)
    })
  }

  // configures element's transition properties, delays, and durations.
  // returns total duration (max delay + max duration)
  private performTransition(elementIndex: number,
                            element: HTMLElement,
                            extraProperties: string[],
                            animationReason: CollectionViewAnimationReason): number {

    const properties = this.configureElementTransitionProperties(element, extraProperties)
    const animations = properties
      .map(property =>
             this.getAnimation(elementIndex, property, animationReason))
    const durations = animations.map(animation => animation.duration)
    const delays = animations.map(animation => animation.delay)
    const timingFunctions = animations.map(animation => animation.timingFunction)

    this.configureElementTransitionDurations(element, durations)
    this.configureElementTransitionDelays(element, delays)
    this.configureElementTransitionTimingFunctions(element, timingFunctions)

    return Math.max(...delays) + Math.max(...durations)
  }

  private getAnimation(elementIndex: number,
                       property: string,
                       reason: CollectionViewAnimationReason): Required<Animation> {

    // if the delegate does not implement the animation method, use the default animation constant
    if (!this.delegate.getAnimation) {
      return this._defaultAnimation as Required<Animation>
    }

    const elementInfo = this.layout.getElementInfo(elementIndex)
    const delegateAnimation = this.delegate.getAnimation(elementIndex, elementInfo, property, reason)
    const duration =
      typeof delegateAnimation.duration === 'number'
        ? Math.max(0, delegateAnimation.duration)
        : this.animationDuration
    const delay =
      duration > 0 && typeof delegateAnimation.delay === 'number'
        ? delegateAnimation.delay
        : 0
    const timingFunction =
      typeof delegateAnimation.timingFunction === 'string'
        ? delegateAnimation.timingFunction
        : 'initial'
    return new Animation(duration, delay, timingFunction) as Required<Animation>
  }

  private getImprovedPositions(currentPosition: Position,
                               newPosition: Position,
                               size: Size): [Position | undefined, Position | undefined] | undefined {

    const {width, height} = size

    const currentIsVisible = this.isVisible(currentPosition, size)
    const newIsVisible = this.isVisible(newPosition, size)

    const movingIn = !currentIsVisible && newIsVisible
    const movingOut = currentIsVisible && !newIsVisible

    if (!movingIn && !movingOut) {
      return
    }

    const {width: containerWidth, height: containerHeight} = this._containerSize
    const {x: minX, y: minY} = this._scrollPosition

    const maxY = minY + containerHeight
    const maxX = minX + containerWidth

    const transitionLine = new Line(currentPosition, newPosition)

    const offset = this.positionImprovementOffset

    // NOTE: offsetting lines to take element size into account + some padding

    // check bottom

    const adjustedBottomLine =
      new Line(new Position(minX, maxY + offset),
               new Position(maxX, maxY + offset))

    const bottomIntersectionPoint = intersect(transitionLine, adjustedBottomLine)
    if (bottomIntersectionPoint) {
      return movingIn
        ? [bottomIntersectionPoint, undefined]
        : [undefined, bottomIntersectionPoint]
    }

    // check top

    const adjustedTopLine =
      new Line(new Position(minX, minY - height - offset),
               new Position(maxX, minY - height - offset))

    const topIntersectionPoint = intersect(transitionLine, adjustedTopLine)
    if (topIntersectionPoint) {
      return movingIn
        ? [topIntersectionPoint, undefined]
        : [undefined, topIntersectionPoint]
    }

    // check left

    const adjustedLeftLine =
      new Line(new Position(minX - width - offset, minY),
               new Position(minX - width - offset, maxY))

    const leftIntersectionPoint = intersect(transitionLine, adjustedLeftLine)
    if (leftIntersectionPoint) {
      return movingIn
        ? [leftIntersectionPoint, undefined]
        : [undefined, leftIntersectionPoint]
    }

    // check right

    const adjustedRightLine =
      new Line(new Position(maxX + offset, minY),
               new Position(maxX + offset, maxY))

    const rightIntersectionPoint = intersect(transitionLine, adjustedRightLine)
    if (rightIntersectionPoint) {
      return movingIn
        ? [rightIntersectionPoint, undefined]
        : [undefined, rightIntersectionPoint]
    }

    return
  }

  isVisible({x: minX, y: minY}: Position, {width, height}: Size): boolean {
    const {width: containerWidth, height: containerHeight} = this._containerSize
    const {x: containerMinX, y: containerMinY} = this._scrollPosition

    const containerMaxX = containerMinX + containerWidth
    const containerMaxY = containerMinY + containerHeight

    const maxX = minX + width
    const maxY = minY + height

    return (
      minX < containerMaxX
      && maxX > containerMinX
      && maxY > containerMinY
      && minY < containerMaxY
    )
  }

  private resize(): void {
    if (this._resizing) {
      this._wantsResize = true
      return
    }
    this._resizing = true

    const completion = () => {
      this._resizing = false

      if (this._wantsResize) {
        this._wantsResize = false
        this.resize()
      }
    }

    this.updateLayout(this._layout)
      .then(completion, completion)
  }

  public updateLayout(newLayout: CollectionViewLayout, animated: boolean = true): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const operation = this.startOperation(reject)

      this.removeScrollListener()

      // update with elements that will be visible after resize

      const newContainerSize = this.currentContainerSize
      const newPosition =
        newLayout.convertPositionInSize(this._scrollPosition, newContainerSize, this._layout)

      // newPosition might not be the final scroll position:
      // when at the bottom and the content is becoming smaller, the view is scrolled up

      const finalContentSize = newLayout.getContentSize(this._count, newContainerSize)

      const finalPosition = new Position(
        Math.max(0,
          newPosition.x - Math.abs(Math.min(0,
          finalContentSize.width
          - (newPosition.x + newContainerSize.width)))),
        Math.max(0,
          newPosition.y - Math.abs(Math.min(0,
          finalContentSize.height
          - (newPosition.y + newContainerSize.height))))
      )

      const finalIndices = this.getIndices(newLayout, finalPosition, newContainerSize)

      const combinedIndices = unique(this._visibleIndices.concat(finalIndices))

      const count = combinedIndices.length
      if (count) {
        const min = combinedIndices.reduce((min, value) => Math.min(min, value))
        const max = combinedIndices.reduce((max, value) => Math.max(max, value))
        this.updateIndices(range(min, max + 1))
      }

      // temporarily shift position of visible elements and scroll
      // to future position, so elements appear to "stay"
      //
      // for example, when transitioning from a vertical grid layout
      // to a horizontal grid layout:
      //
      // ┌───┬───────┏━━━┓───┐
      // │   │       ┃   ┃   │
      // ├───┼───────┗━━━┛───┘
      // │   │         ▲
      // │   │         │
      // │   │
      // ┏━━━┓         │
      // ┃   ┃─ ─ ─ ─ ─
      // ┗━━━┛
      // │   │
      // │   │
      // └───┘

      const diffX = Math.round(newPosition.x - this._scrollPosition.x)
      const diffY = Math.round(newPosition.y - this._scrollPosition.y)

      if (diffX || diffY) {
        this._elements.forEach(element => {
          element.style.transform += ` translate3d(${diffX}px, ${diffY}px, 0)`
        })
      }

      this.updateContentSize(newLayout)

      this.scrollTo(newPosition)

      this._scrollPosition = finalPosition

      this.updateContainerSize(newLayout)

      // reposition (NOTE: delay important)
      this.delayForOperation(operation, () => {

        this.repositionVisibleElements(newLayout,
                                       false,
                                       operation,
                                       animated
                                         ? CollectionViewAnimationReason.LAYOUT_UPDATE
                                         : undefined)
          .then(() => {
            this.updateCurrentIndices()

            this.addScrollListener()

            resolve()
          })
          .catch(reject)

        this._elements.forEach((element, index) => {
          assert(() => index >= 0)
          newLayout.configureElement(element, index)
        })

        this._layout = newLayout

      }, 0)
    })
  }

  public scrollTo({x: toX, y: toY}: Position, animated: boolean = false): void {
    if (animated) {
      const start = Date.now()
      const {x: fromX, y: fromY} = this.currentScrollPosition
      const easing = CollectionView.SCROLL_EASING
      const scroll = () => {
        const now = Date.now()
        const progress = Math.min(1, (now - start) / this.animationDuration)
        const easedProgress = easing(progress)
        const targetX = fromX + easedProgress * (toX - fromX)
        const targetY = fromY + easedProgress * (toY - fromY)
        this.scrollTo(new Position(targetX, targetY), false)

        if (progress < 1) {
          requestAnimationFrame(scroll)
        }
      }
      requestAnimationFrame(scroll)
    } else {
      this._container.scrollLeft = toX
      this._container.scrollTop = toY
    }
  }

  private removeFromParent(element: HTMLElement): void {
    const parent = element.parentElement
    if (!parent) {
      return
    }

    parent.removeChild(element)
  }

  public changeIndices(removedIndices: number[],
                       addedIndices: number[],
                       movedIndexMap: Map<number, number>,
                       animated: boolean = true): Promise<void> {

    return new Promise<void>((resolve, reject) => {
      const operation = this.startOperation(reject)

      const promises: Promise<void>[] = []

      // handle legacy Object
      if (!(movedIndexMap instanceof Map)) {
        const movedIndexObject = movedIndexMap as {[key: string]: any}
        const pairs = Object.keys(movedIndexObject)
          .map((key): [number, number] =>
                 [Number(key), Number(movedIndexObject[key])])
        movedIndexMap = new Map<number, number>(pairs)
      }

      this.removeScrollListener()

      // prepare moved mapping

      const oldMovedIndices = Array.from(movedIndexMap.keys())
      const reverseMovedIndexMap = new Map<number, number>()
      oldMovedIndices.forEach(oldIndex => {
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

      const {width: newContentWidth, height: newContentHeight} =
        this._layout.getContentSize(this._count, this._containerSize)

      const {width: containerWidth, height: containerHeight} = this._containerSize
      const {x: scrollX, y: scrollY} = this._scrollPosition

      const right = scrollX + containerWidth
      const adjustX = right > newContentWidth

      const bottom = scrollY + containerHeight
      const adjustY = bottom > newContentHeight

      if (adjustX || adjustY) {
        this._scrollPosition =
          new Position(adjustX
                         ? Math.max(0, scrollX - (right - newContentWidth))
                         : scrollX,
                       adjustY
                         ? Math.max(0, scrollY - (bottom - newContentHeight))
                         : scrollY)

        // TODO: how to handle variable duration here?
        this.scrollTo(this._scrollPosition, animated)
      }

      // disappear and remove elements

      removedIndices.forEach(elementIndex => {
        assert(() => elementIndex >= 0)

        const element = this._elements.get(elementIndex)
        if (!element) {
          return
        }

        const disappearedStyle: Style =
          Object.assign({zIndex: '0', opacity: '0'},
                        this.getStyle(elementIndex, element,
                                      CollectionViewAnimationPhase.ELEMENT_DISAPPEARED))

        // TODO: include 'transform' in properties?
        const maxTransitionDuration =
          this.performTransition(elementIndex,
                                 element,
                                 Object.keys(disappearedStyle),
                                 CollectionViewAnimationReason.ELEMENT_REMOVAL)

        this.applyStyle(disappearedStyle, element)

        promises.push(new Promise<void>(resolve => {

          // NOTE: notify delegate about invalidation after element was removed
          // (animation finished), not immediately when stopping to keep track of it
          // NOTE: no need to check for current operation!
          setTimeout(() => {
                       this.removeFromParent(element)
                       if (this.delegate.invalidateElement) {
                         this.delegate.invalidateElement(element, elementIndex)
                       }

                       // TODO: reset transition properties/durations/delays after animation completed?

                       resolve()
                     },
                     maxTransitionDuration)
        }))

        this._elements.delete(elementIndex)
        this._positions.delete(element)
      })

      // reorder visible elements

      const removedOrMovedIndices = sort(removedIndices.concat(oldMovedIndices))
      const addedOrMovedIndices = sort(addedIndices.concat(newMovedIndices))

      let removedOrMovedReorderOffset = 0
      const newElements = new Map<number, HTMLElement>()

      const indices = sort(Array.from(this._elements.keys()))

      indices.forEach(index => {
        const element = this._elements.get(index) as HTMLElement
        assert(() => index >= 0)

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

        assert(() => newIndex >= 0)
        newElements.set(newIndex, element)
      })
      this._elements = newElements

      // load visible elements

      const finalIndices = sort(this.currentIndices)

      let removedOrMovedLoadOffset = 0
      let addedOrMovedLoadOffset = 0

      finalIndices.forEach(index => {

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

        assert(() => index >= 0)
        const existingElement = this._elements.get(index)
        if (existingElement) {
          return
        }

        const element = this.createAndAddElement()
        const isNew = addedIndices.indexOf(index) >= 0
        const layoutIndex = isNew ? index : oldIndex
        this.configureElement(this._layout, element, index)
        this.getAndApplyElementPosition(this._layout, element, layoutIndex)

        if (isNew) {

          const appearingStyle: Style =
            Object.assign({opacity: '0'},
                          this.getStyle(layoutIndex, element,
                                        CollectionViewAnimationPhase.ELEMENT_APPEARING))

          this.applyStyle(appearingStyle, element)

          // TODO: trigger restyle in a more proper way
          // tslint:disable-next-line:no-unused-expression
          window.getComputedStyle(element).opacity

          // TODO: include 'transform' property?
          // TODO: include appearedStyle properties?
          this.performTransition(layoutIndex,
                                 element,
                                 Object.keys(appearingStyle),
                                 CollectionViewAnimationReason.ELEMENT_ADDITION)


          const appearedStyle: Style =
            Object.assign({opacity: '1'},
                          this.getStyle(layoutIndex, element,
                                        CollectionViewAnimationPhase.ELEMENT_APPEARED))

          this.applyStyle(appearedStyle, element)

          // TODO: reset transition properties/durations/delays after animation completed?

        } else {
          // NOTE: important, forces a relayout
          element.getBoundingClientRect()
        }
        this._elements.set(index, element)
      })

      this._visibleIndices = finalIndices

      // reposition

      promises.push(new Promise<void>((resolve, reject) => {

        // NOTE: delay important
        this.delayForOperation(operation, () => {

          this.repositionVisibleElements(this._layout,
                                         true,
                                         operation,
                                         animated
                                           ? CollectionViewAnimationReason.ELEMENT_MOVE
                                           : undefined)
            .then(() => {


              this.updateCurrentIndices()


              resolve()
            })
            .catch(reject)

        }, 0)
      }))

      Promise.all(promises)
        .then(() => {
          if (countDifference < 0) {
            this.updateContentSize(this._layout)
          }

          this.addScrollListener()

          resolve()
        })
        .catch(reason => {
          this.addScrollListener()

          reject(reason)
        })
    })
  }

  private addScrollListener() {
    if (!this._installed) {
      return
    }

    this._container.addEventListener('scroll', this.onScroll, false)
  }

  private removeScrollListener() {
    this._container.removeEventListener('scroll', this.onScroll, false)
  }

  private applyStyle(style: Style, element: HTMLElement) {
    for (let property in style) {
      if (!style.hasOwnProperty(property))
        continue
      element.style.setProperty(property, style[property])
    }
  }

  private startOperation(reject: (reason?: any) => void): Operation {
    const operation = new Operation(reject)
    this._currentOperation = operation
    return operation
  }

  private checkCurrentOperation(operation: Operation): boolean {
    if (this._currentOperation !== operation) {
      operation.reject()
      return false
    }

    return true
  }

  private delayForOperation(operation: Operation,
                            func: () => void,
                            duration: number): void {
    setTimeout(() => {
      if (!this.checkCurrentOperation(operation)) {
        return
      }

      func()
    }, duration)
  }

  // configures the element's transition properties and returns them
  private configureElementTransitionProperties(element: HTMLElement, extraProperties: string[] = []): string[] {
    const properties = Array.from(new Set(CollectionView.DEFAULT_TRANSITION_PROPERTIES.concat(extraProperties)))
    element.style.transitionProperty = Array(properties.values()).join(',')
    return properties
  }

  private configureElementTransitionDurations(element: HTMLElement, durations: number[]) {
    element.style.transitionDuration = durations.map(duration => duration + 'ms').join(',')
  }

  private configureElementTransitionDelays(element: HTMLElement, delays: number[]) {
    element.style.transitionDelay = delays.map(delay => delay + 'ms').join(',')
  }

  private configureElementTransitionTimingFunctions(element: HTMLElement, timingFunctions: string[]) {
    element.style.transitionTimingFunction = timingFunctions.join(',')
  }

  private getStyle(elementIndex: number, element: HTMLElement, phase: CollectionViewAnimationPhase): Style {
    if (!this.delegate.getStyle) {
      return {}
    }
    const position = this._positions.get(element)
    if (!position) {
      throw Error("missing position for element: " + element)
    }
    const elementInfo = this.layout.getElementInfo(elementIndex)
    return this.delegate.getStyle(elementIndex, phase, elementInfo, position) || {}
  }
}
