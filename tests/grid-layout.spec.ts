import { BoundingBox, Browser, ElementHandle, launch, Page } from 'puppeteer'
import * as path from 'path'
import { CollectionViewDelegate, GridLayoutParameters, Size as ImportedSize, CollectionView, GridLayout } from '../dist'

jest.setTimeout(10000)

let page: Page
let browser: Browser
const width = 1024
const height = 1024

beforeAll(async () => {
  if (process.env.CI === 'true') {
    browser = await launch({
                             headless: true,
                             slowMo: 200,
                             args: [
                               `--window-size=${width},${height}`,
                               '--no-sandbox',
                               '--disable-setuid-sandbox'
                             ]
                           });
  } else {
    browser = await launch({
                             headless: false,
                             slowMo: 200,
                             args: [
                               `--window-size=${width},${height}`,
                             ]
                           })
  }
})

afterAll(async () => {
  await browser.close()
})

beforeEach(async () => {
  page = await browser.newPage()
  await page.setViewport({ width, height })
  page.once('pageerror', fail)
  const envURL = 'file://' + path.resolve(__dirname, 'env', 'index.html')
  await page.goto(envURL, {"waitUntil" : "networkidle0"})
})

// only used to help TypeScript in evaluate calls. see env/src/index.js
declare const delegate: CollectionViewDelegate
declare const collectionView: CollectionView
declare const wrapperElement: HTMLDivElement
declare const newGridLayout: (params: GridLayoutParameters) => GridLayout
declare const Size: (width: number, height: number) => ImportedSize

async function getElements(): Promise<ElementHandle[]> {
  return await page.$$('#scroll div')
}

async function getBoundingBoxesAndContents(elements: ElementHandle[]): Promise<[BoundingBox, string][]> {
  const unsorted: [BoundingBox, string][] = await Promise.all(elements.map(element => {
    return Promise.all([
                         element.boundingBox() as Promise<BoundingBox>,
                         page.evaluate(element => element.innerText, element)
                       ])
  }))

  return unsorted
    .sort((a, b) => {
      const boxA = a[0]
      const boxB = b[0]
      if (boxA.y < boxB.y)
        return -1
      if (boxA.y > boxB.y)
        return 1
      if (boxA.x < boxB.x)
        return -1
      if (boxA.x > boxB.x)
        return 1
      return 0
    })
}

async function expectElements(expected: [number, number, string][], size: [number, number]) {
  const elements = await getElements()
  const actualBoundingBoxesAndContents = await getBoundingBoxesAndContents(elements)

  // console.debug(actualBoundingBoxesAndContents.map(([box, content]) => box && [box.x, box.y, content]))

  const expectedBoundingBoxesAndContents =
    expected.map(([x, y, content]): [BoundingBox, string] =>
                   [{x, y, width: size[0], height: size[1]}, content])

  expect(actualBoundingBoxesAndContents)
    .toEqual(expectedBoundingBoxesAndContents)
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Collection View with default Grid Layout", () => {

  test("add elements and scroll", async () => {

    // add elements
    await page.evaluate(() => {
      const items = Array.from(Array(100).keys())
      delegate.items = items
      const addedIndices = items.map((_, index) => index)
      return collectionView.changeIndices([], addedIndices, new Map())
    })

    // check first set of elements were loaded
    await expectElements(
      [
        [ 80, 10, '0'], [ 300, 10, '1' ], [ 520, 10 , '2'],
        [ 80, 230 , '3'], [ 300, 230 , '4'], [ 520, 230 , '5'],
        [ 80, 450 , '6'], [ 300, 450, '7' ], [ 520, 450, '8' ]
      ],
      [200, 200]
    )

    // scroll down a bit
    await page.evaluate(() => {
      wrapperElement.scrollBy(0,140)
    })

    // check more elements are loaded
    await expectElements(
      [
        [ 80, -130, '0'], [ 300, -130, '1' ], [ 520, -130, '2' ],
        [ 80, 90, '3' ], [ 300, 90, '4' ], [ 520, 90, '5' ],
        [ 80, 310, '6' ], [ 300, 310, '7' ], [ 520, 310, '8' ],
        [ 80, 530, '9'], [ 300, 530, '10'  ], [ 520, 530, '11' ]
      ],
      [200, 200]
    )

    // scroll down a bit more
    await page.evaluate(() => {
      wrapperElement.scrollBy(0,200)
    })

    // check more elements are loaded, and elements are reused
    await expectElements(
      [
        [ 80, -110, '3' ], [ 300, -110, '4' ], [ 520, -110, '5' ],
        [ 80, 110, '6' ], [ 300, 110, '7' ], [ 520, 110, '8' ],
        [ 80, 330, '9' ], [ 300, 330, '10' ], [ 520, 330, '11' ],
        [ 80, 550, '12' ], [ 300, 550, '13' ], [ 520, 550, '14' ],

      ],
      [200, 200]
    )
  });

  test("change elements", async () => {

    // add initial elements
    await page.evaluate(() => {
      const initialElements = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      delegate.items = initialElements.slice()
      const addedIndices = initialElements.map((_, index) => index)
      return collectionView.changeIndices([], addedIndices, new Map())
    })

    // change elements
    await page.evaluate(() => {
      delegate.items = [ 1, 15, 16, 3, 6, 8, 4, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([ 1, 4, 6, 8 ],
                                          [ 1, 2 ],
                                          new Map([[3, 6]]))
    })

    // check the elements were changed properly
    await expectElements(
      [
        [ 80, 10, '1' ], [ 300, 10, '15' ], [ 520, 10, '16' ],
        [ 80, 230, '3' ], [ 300, 230, '6' ], [ 520, 230, '8' ],
        [ 80, 450, '4' ], [ 300, 450, '10' ], [ 520, 450, '11' ]
      ],
      [ 200, 200 ]
    )

    // change the elements back to the initial state
    await page.evaluate(() => {
      delegate.items = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([1, 2], [1, 4, 6, 8], new Map([[6, 3]]))
    })

    // check the elements were changed properly
    await expectElements(
      [
        [ 80, 10, '1' ], [ 300, 10, '2' ], [ 520, 10, '3' ],
        [ 80, 230, '4' ], [ 300, 230, '5' ], [ 520, 230, '6' ],
        [ 80, 450, '7' ], [ 300, 450, '8' ], [ 520, 450, '9' ]
      ],
      [ 200, 200 ]
    )
  });

  test("change elements at bottom", async () => {

    // add initial elements
    await page.evaluate(() => {
      const initialElements = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      delegate.items = initialElements.slice()
      const addedIndices = initialElements.map((_, index) => index)
      return collectionView.changeIndices([], addedIndices, new Map())
    })

    // scroll to bottom
    await page.evaluate(() => {
      wrapperElement.scrollTo(0, wrapperElement.scrollHeight)
    })

    // change elements
    await page.evaluate(() => {
      delegate.items = [ 1, 15, 16, 3, 6, 8, 4, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([ 1, 4, 6, 8 ],
                                          [ 1, 2 ],
                                          new Map([[3, 6]]))
    })

    // check the elements were changed properly
    await expectElements(
      [
        [ 80, -70, '3' ], [ 300, -70, '6' ], [ 520, -70, '8' ],
        [ 80, 150, '4' ], [ 300, 150, '10' ], [ 520, 150, '11' ],
        [ 80, 370, '12' ], [ 300, 370, '13' ], [ 520, 370, '14' ]
      ],
      [ 200, 200 ]
    )

    // change the elements back to the initial state
    await page.evaluate(() => {
      delegate.items = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([1, 2], [1, 4, 6, 8], new Map([[6, 3]]))
    })

    // check the elements were changed properly
    await expectElements(
      [
        [ 80, -70, '4' ], [ 300, -70, '5' ], [ 520, -70, '6' ],
        [ 80, 150, '7' ], [ 300, 150, '8' ], [ 520, 150, '9' ],
        [ 80, 370, '10' ], [ 300, 370, '11' ], [ 520, 370, '12' ],
        [ 80, 590, '13' ], [ 300, 590, '14' ]
      ],
      [ 200, 200 ]
    )
  });

  test("change elements, one interruption", async () => {
    const animationDuration = await page.evaluate(() => collectionView.animationDuration)

    // add initial elements
    await page.evaluate(() => {
      const initialElements = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      delegate.items = initialElements.slice()
      const addedIndices = initialElements.map((_, index) => index)
      return collectionView.changeIndices([], addedIndices, new Map())
    })

    // change elements
    // NOTE: not waiting, this promise is checked later
    const firstUpdate = page.evaluate(() => {
      delegate.items = [ 1, 15, 16, 3, 6, 8, 4, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([ 1, 4, 6, 8 ],
                                          [ 1, 2 ],
                                          new Map([[3, 6]]))
      // recover cancellation as promise resolution which can be checked
        .catch(() => Promise.resolve('update failed'))
    })

    // wait for more than half of the first update to complete
    await wait(animationDuration * 0.55)

    // change the elements back to the initial state
    await page.evaluate(() => {
      delegate.items = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([1, 2], [1, 4, 6, 8], new Map([[6, 3]]))
    })

    // check the elements were changed back properly
    await expectElements(
      [
        [ 80, 10, '1' ], [ 300, 10, '2' ], [ 520, 10, '3' ],
        [ 80, 230, '4' ], [ 300, 230, '5' ], [ 520, 230, '6' ],
        [ 80, 450, '7' ], [ 300, 450, '8' ], [ 520, 450, '9' ]
      ],
      [ 200, 200 ]
    )

    // the first update should have failed
    expect(await firstUpdate).toEqual('update failed')
  });

  test("change elements, multiple interruptions", async () => {

    const animationDuration = await page.evaluate(() => collectionView.animationDuration)

    // add initial elements
    await page.evaluate(() => {
      const initialElements = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      delegate.items = initialElements.slice()
      const addedIndices = initialElements.map((_, index) => index)
      return collectionView.changeIndices([], addedIndices, new Map())
    })

    // change elements; will not complete successfully,
    // as it will be interrupted by a following change
    // NOTE: not waiting, this promise is checked later
    const firstUpdate = page.evaluate(() => {
      delegate.items = [ 1, 15, 16, 3, 6, 8, 4, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([ 1, 4, 6, 8 ],
                                          [ 1, 2 ],
                                          new Map([[3, 6]]))
      // recover cancellation as promise resolution which can be checked
        .catch(() => Promise.resolve('first update failed'))
    })

    // wait for more than half of the first update to complete
    await wait(animationDuration * 0.55)

    // change the elements back to the initial state;
    // will not complete successfully either,
    // as it will also be interrupted by a following change
    // NOTE: not waiting, this promise is checked later

    const secondUpdate = page.evaluate(() => {
      delegate.items = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([1, 2], [1, 4, 6, 8], new Map([[6, 3]]))
      // recover cancellation as promise resolution which can be checked
        .catch(() => Promise.resolve('second update failed'))
    })

    // wait for more than half of the second update to complete
    await wait(animationDuration * 0.55)

    // change elements again; will complete successfully
    // NOTE: waiting, this promise should succeed
    await page.evaluate(() => {
      delegate.items = [ 1, 15, 16, 3, 6, 8, 4, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([ 1, 4, 6, 8 ],
                                          [ 1, 2 ],
                                          new Map([ [ 3, 6 ] ]))
    });

    // check the elements were changed properly
    await expectElements(
      [
        [ 80, 10, '1' ], [ 300, 10, '15' ], [ 520, 10, '16' ],
        [ 80, 230, '3' ], [ 300, 230, '6' ], [ 520, 230, '8' ],
        [ 80, 450, '4' ], [ 300, 450, '10' ], [ 520, 450, '11' ]
      ],
      [ 200, 200 ]
    )

    // the first update should have failed
    expect(await firstUpdate).toEqual('first update failed')

    // the second update should have also failed
    expect(await secondUpdate).toEqual('second update failed')
  });

  test("change layout", async () => {

    // add initial elements
    await page.evaluate(() => {
      const initialElements = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      delegate.items = initialElements.slice()
      const addedIndices = initialElements.map((_, index) => index)
      return collectionView.changeIndices([], addedIndices, new Map())
    })

    // change layout
    await page.evaluate(() => {
      return collectionView.updateLayout(newGridLayout({itemSize: new Size(300, 300)}))
    })

    // check the elements were changed properly
    await expectElements(
      [
        [ 90, 10, '1'], [ 410, 10, '2'],
        [ 90, 330, '3'], [ 410, 330, '4']
      ],
      [ 300, 300 ]
    )

    // change the layout back to the initial state
    await page.evaluate(() => {
      return collectionView.updateLayout(newGridLayout({itemSize: new Size(200, 200)}))
    })

    // check the elements were changed properly
    await expectElements(
      [
        [ 80, 10, '1' ], [ 300, 10, '2' ], [ 520, 10, '3' ],
        [ 80, 230, '4' ], [ 300, 230, '5' ], [ 520, 230, '6' ],
        [ 80, 450, '7' ], [ 300, 450, '8' ], [ 520, 450, '9' ]
      ],
      [ 200, 200 ]
    )
  });

  test("change layout at bottom", async () => {

    // change layout
    await page.evaluate(() => {
      return collectionView.updateLayout(newGridLayout({itemSize: new Size(260, 260)}))
    })

    // add initial elements
    await page.evaluate(() => {
      const initialElements = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      delegate.items = initialElements.slice()
      const addedIndices = initialElements.map((_, index) => index)
      return collectionView.changeIndices([], addedIndices, new Map())
    })

    // scroll to bottom
    await page.evaluate(() => {
       wrapperElement.scrollTo(0, wrapperElement.scrollHeight)
    })

    // change layout
    await page.evaluate(() => {
      return collectionView.updateLayout(newGridLayout({itemSize: new Size(180, 180)}))
    })

    // check the elements were changed properly
    await expectElements(
      [
        [ 10, -10, '5' ], [ 210, -10, '6' ], [ 410, -10, '7' ], [ 610, -10, '8' ],
        [ 10, 190, '9' ], [ 210, 190, '10' ], [ 410, 190, '11' ], [ 610, 190, '12' ],
        [ 10, 390, '13' ], [ 210, 390, '14' ]
      ],
      [ 180, 180 ]
    )
  })
})

