import { describe, expect, it } from 'vitest'
import { ViewTransform, displayForScale } from './transforms'

describe('ViewTransform', () => {
  const t = new ViewTransform(600, 800)

  it('convierte PDF (bottom-left) a normalized [0,1] (top-left)', () => {
    const box = t.pdfToNormalized(0, 0, 600, 400)
    expect(box.x).toBe(0)
    expect(box.y).toBe(0.5)
    expect(box.width).toBe(1)
    expect(box.height).toBe(0.5)
  })

  it('redondea round-trip normalized <-> PDF', () => {
    const source = { x: 150, y: 100, width: 300, height: 500 }
    const norm = t.pdfToNormalized(source.x, source.y, source.width, source.height)
    const back = t.normalizedToPdf(norm)
    expect(back.x).toBeCloseTo(source.x)
    expect(back.y).toBeCloseTo(source.y)
    expect(back.width).toBeCloseTo(source.width)
    expect(back.height).toBeCloseTo(source.height)
  })

  it('convierte normalized a web con escala', () => {
    const norm = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
    const web = t.normalizedToWeb(norm, 1200, 1600)
    expect(web.x).toBe(300)
    expect(web.y).toBe(400)
    expect(web.width).toBe(600)
    expect(web.height).toBe(800)
  })
})

describe('displayForScale', () => {
  it('calcula dimensiones de display a escala', () => {
    const view = displayForScale(600, 800, 2)
    expect(view.displayWidth).toBe(1200)
    expect(view.displayHeight).toBe(1600)
    expect(view.scale).toBe(2)
  })
})