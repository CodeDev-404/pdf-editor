import { describe, expect, it, beforeAll } from 'vitest'
import { renderPageToCanvasOffscreen } from './imageExport'
import type { PdfEngine } from '@/core/PdfEngine'
import type { PageInfo } from '@/types'

function makeMock2dCtx() {
  const props: Record<string, unknown> = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
    lineJoin: 'miter',
  }
  return new Proxy(
    {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      setLineDash: () => {},
      drawImage: () => {},
      translate: () => {},
      rotate: () => {},
    },
    {
      get(target, prop) {
        if (prop in props) return props[prop]
        return Reflect.get(target, prop)
      },
      set(target, prop, value) {
        if (prop in props) {
          props[prop] = value
          return true
        }
        return Reflect.set(target, prop, value)
      },
    },
  ) as unknown as CanvasRenderingContext2D
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
  ) {
    if (contextId === '2d') return makeMock2dCtx() as never
    return null as never
  } as typeof HTMLCanvasElement.prototype.getContext
})

/** Engine stub: no carga pdf.js, simula el render del fondo de página. */
const stubEngine = {
  async renderPageToCanvas(
    _index: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<void> {
    canvas.width = 600 * scale
    canvas.height = 800 * scale
  },
} as unknown as PdfEngine

describe('imageExport', () => {
  it('renderiza la página a un canvas de alta resolución con anotaciones', async () => {
    const pageInfo: PageInfo = { index: 0, width: 600, height: 800, rotation: 0 }

    const canvas = await renderPageToCanvasOffscreen(
      stubEngine,
      pageInfo,
      [
        {
          id: 'ann-1',
          pageIndex: 0,
          type: 'rect',
          color: '#dc2626',
          strokeWidth: 0.01,
          opacity: 1,
          box: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
        },
      ],
      { scale: 2 },
    )
    expect(canvas.width).toBe(1200)
    expect(canvas.height).toBe(1600)

    const ctx = canvas.getContext('2d')
    expect(ctx).toBeTruthy()
  })

  it('omite las anotaciones ocultas del render', async () => {
    const pageInfo: PageInfo = { index: 0, width: 600, height: 800, rotation: 0 }

    const canvas = await renderPageToCanvasOffscreen(
      stubEngine,
      pageInfo,
      [
        {
          id: 'ann-1',
          pageIndex: 0,
          type: 'rect',
          color: '#dc2626',
          strokeWidth: 0.01,
          opacity: 1,
          hidden: true,
          box: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
        },
      ],
      { scale: 1 },
    )
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(800)
  })
})