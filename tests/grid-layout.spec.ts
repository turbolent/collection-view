import { BoundingBox, Browser, ElementHandle, launch, Page } from 'puppeteer'
import * as path from 'path'
import { CollectionViewDelegate, GridLayoutParameters } from '../src'
import CollectionView from '../src/collection-view'
import GridLayout from '../src/grid-layout'

jest.setTimeout(10000);

let page: Page;
let browser: Browser;
const width = 1024;
const height = 1024;

beforeAll(async () => {
  browser = await launch({
                           headless: true,
                           slowMo: 200,
                           args: [
                             `--window-size=${width},${height}`,
                             '--no-sandbox',
                             '--disable-setuid-sandbox'
                           ]
                         });
})

afterAll(async () => {
  await browser.close();
})

beforeEach(async () => {
  page = await browser.newPage();
  await page.setViewport({ width, height });
  page.once('pageerror', fail)
  const envURL = 'file://' + path.resolve(__dirname, 'env', 'index.html')
  await page.goto(envURL, {"waitUntil" : "networkidle0"});
})

// only used to help TypeScript in evaluate calls. see env/src/index.js
declare const delegate: CollectionViewDelegate;
declare const collectionView: CollectionView;
declare const wrapperElement: HTMLDivElement;
declare const newGridLayout: (params: GridLayoutParameters) => GridLayout;

async function getElements(): Promise<ElementHandle[]> {
  return await page.$$('#scroll div')
}

async function getBoundingBoxes(elements: ElementHandle[]): Promise<(BoundingBox | null)[]> {
  return await Promise.all(elements.map(element => element.boundingBox()))
}

async function getContents(elements: ElementHandle[], boundingBoxes: (BoundingBox | null)[]): Promise<string[]> {
  const unsorted = await Promise.all(elements.map(element =>
                                                    page.evaluate(element => element.innerText, element)))
  return unsorted
    .map((content, index): [string, number] => [content, index])
    .sort((a, b) => {
      const boxA = boundingBoxes[a[1]]
      const boxB = boundingBoxes[b[1]]
      if (!boxA || !boxB)
        return 0;
      if (boxA.y < boxB.y)
        return -1;
      if (boxA.y > boxB.y)
        return 1;
      if (boxA.x < boxB.x)
        return -1;
      if (boxA.x > boxB.x)
        return 1;
      return 0
    })
    .map((contentAndIndex) => contentAndIndex[0])
}

function asBoundingBox(position: number[], size: [number, number]): BoundingBox {
  return {
    x: position[0],
    y: position[1],
    width: size[0],
    height: size[1]
  }
}

// to get actual positions:
// console.debug(boundingBoxes.map(box => box && [box.x, box.y]))

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
    {
      const elements = await getElements()
      const boundingBoxes = await getBoundingBoxes(elements)
      expect(boundingBoxes).toEqual(
        [
          [ 80, 10 ], [ 300, 10 ], [ 520, 10 ],
          [ 80, 230 ], [ 300, 230 ], [ 520, 230 ],
          [ 80, 450 ], [ 300, 450 ], [ 520, 450 ]
        ].map(position => asBoundingBox(position, [ 200, 200 ]))
      )

      const contents = await getContents(elements, boundingBoxes)
      expect(contents).toEqual([ '0', '1', '2', '3', '4', '5', '6', '7', '8' ])
    }

    // scroll down a bit
    await page.evaluate(() => {
      wrapperElement.scrollBy(0,140)
    })

    // check more elements are loaded
    {
      const elements = await getElements()
      const boundingBoxes = await getBoundingBoxes(elements)
      expect(boundingBoxes).toEqual(
        [
          [ 80, -130 ], [ 300, -130 ], [ 520, -130 ],
          [ 80, 90 ], [ 300, 90 ], [ 520, 90 ],
          [ 80, 310 ], [ 300, 310 ], [ 520, 310 ],
          [ 80, 530 ], [ 300, 530 ], [ 520, 530 ]
        ].map(position => asBoundingBox(position, [ 200, 200 ]))
      )

      const contents = await getContents(elements, boundingBoxes)
      expect(contents).toEqual([ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11' ])
    }

    // scroll down a bit more
    await page.evaluate(() => {
      wrapperElement.scrollBy(0,200)
    })

    // check more elements are loaded, and elements are reused
    {
      const elements = await getElements()
      const boundingBoxes = await getBoundingBoxes(elements)

      // NOTE: elements of first row are reused: first in order, but positioned as last row
      expect(boundingBoxes).toEqual(
        [
          [ 520, 550 ], [ 300, 550 ], [ 80, 550 ],
          [ 80, -110 ], [ 300, -110 ], [ 520, -110 ],
          [ 80, 110 ], [ 300, 110 ], [ 520, 110 ],
          [ 80, 330 ], [ 300, 330 ], [ 520, 330 ]
        ].map(position => asBoundingBox(position, [ 200, 200 ]))
      )

      const contents = await getContents(elements, boundingBoxes)
      expect(contents).toEqual([ '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14' ])
    }
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
    {
      const elements = await getElements()
      const boundingBoxes = await getBoundingBoxes(elements)
      expect(boundingBoxes).toEqual(
        [
          [ 80, 10 ], [ 80, 230 ], [ 80, 450 ],
          [ 300, 230 ], [ 520, 230 ], [ 300, 10 ],
          [ 520, 10 ], [ 300, 450 ], [ 520, 450 ]
        ].map(position => asBoundingBox(position, [ 200, 200 ]))
      )

      const contents = await getContents(elements, boundingBoxes)
      expect(contents).toEqual([ '1', '15', '16', '3', '6', '8', '4', '10', '11' ])
    }

    // change the elements back to the initial state
    await page.evaluate(() => {
      delegate.items = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 ]
      return collectionView.changeIndices([1, 2], [1, 4, 6, 8], new Map([[6, 3]]))
    })

    // check the elements were changed properly
    {
      const elements = await getElements()
      const boundingBoxes = await getBoundingBoxes(elements)

      expect(boundingBoxes).toEqual(
        [
          [ 80, 10 ], [ 520, 10 ], [ 80, 230 ],
          [ 520, 230 ], [ 300, 450 ], [ 300, 10 ],
          [ 300, 230 ], [ 80, 450 ], [ 520, 450 ]
        ].map(position => asBoundingBox(position, [ 200, 200 ]))
      )

      const contents = await getContents(elements, boundingBoxes)
      expect(contents).toEqual([ '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    }
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
      return collectionView.updateLayout(newGridLayout({itemSize: [300, 300]}))
    })

    // check the elements were changed properly
    {
      const elements = await getElements()
      const boundingBoxes = await getBoundingBoxes(elements)

      expect(boundingBoxes).toEqual(
        [
          [ 90, 10 ], [ 410, 10 ],
          [ 90, 330 ], [ 410, 330 ]
        ].map(position => asBoundingBox(position, [ 300, 300 ]))
      )

      const contents = await getContents(elements, boundingBoxes)
      expect(contents).toEqual([ '1', '2', '3', '4' ])
    }

    // change the layout back to the initial state
    await page.evaluate(() => {
      return collectionView.updateLayout(newGridLayout({itemSize: [200, 200]}))
    })

    // check the elements were changed properly
    {
      const elements = await getElements()
      const boundingBoxes = await getBoundingBoxes(elements)

      expect(boundingBoxes).toEqual(
        [
          [ 80, 10 ], [ 300, 10 ], [ 520, 10 ],
          [ 80, 230 ], [ 300, 230 ], [ 520, 230 ],
          [ 80, 450 ], [ 300, 450 ], [ 520, 450 ]
        ].map(position => asBoundingBox(position, [ 200, 200 ]))
      )

      const contents = await getContents(elements, boundingBoxes)
      expect(contents).toEqual([ '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    }
  });
});
