import Tesseract from 'tesseract.js'
import type { TextItem, PageInfo } from '@/types'
import type { PdfEngine } from '@/core/PdfEngine'

export interface OcrOptions {
  /** lenguajes tesseract separados por '+', p.ej. 'spa+eng' */
  lang?: string
  /** escala de renderizado de la imagen a analizar (mayor = más precisión) */
  scale?: number
  onProgress?: (progress: number, status?: string) => void
}

function bboxToBox(bbox: { x0: number; y0: number; x1: number; y1: number }, imgW: number, imgH: number) {
  return {
    x: Math.max(0, Math.min(1, bbox.x0 / imgW)),
    y: Math.max(0, Math.min(1, bbox.y0 / imgH)),
    width: Math.max(0, Math.min(1, (bbox.x1 - bbox.x0) / imgW)),
    height: Math.max(0, Math.min(1, (bbox.y1 - bbox.y0) / imgH)),
  }
}

/**
 * Ejecuta OCR sobre una página del PDF (convertida a imagen) y devuelve los
 * items de texto detectados, listos para: búsqueda, capa de edición WYSIWYG
 * y export. La detección es a nivel de línea para evitar fragmentar palabras.
 */
export async function ocrPage(
  engine: PdfEngine,
  page: PageInfo,
  options: OcrOptions = {},
): Promise<TextItem[]> {
  const { lang = 'spa+eng', scale = 2, onProgress } = options

  const img = document.createElement('canvas')
  await engine.renderPageToCanvas(page.index, img, scale)
  const W = img.width
  const H = img.height

  const result = await Tesseract.recognize(img, lang, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })

  const items: TextItem[] = []
  const blocks = result.data.blocks ?? []
  let counter = 0
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const text = (line.text ?? '').trim()
        if (!text) continue
        const bbox = line.bbox
        if (!bbox) continue
        items.push({
          id: `ocr-${page.index}-${counter++}`,
          pageIndex: page.index,
          str: text,
          box: bboxToBox(bbox, W, H),
          fontSizePx: Math.max(8, (bbox.y1 - bbox.y0) / scale),
          fontFamily: 'Helvetica',
          color: '#000000',
          hasEOL: true,
        })
      }
    }
  }

  // Si Tesseract no segmenta por líneas, usa el texto plano para al menos
  // tener contenido buscable.
  if (items.length === 0 && result.data.text?.trim()) {
    items.push({
      id: `ocr-${page.index}-0`,
      pageIndex: page.index,
      str: result.data.text.replace(/\s+/g, ' ').trim(),
      box: { x: 0.02, y: 0.02, width: 0.96, height: 0.96 },
      fontSizePx: 12,
      fontFamily: 'Helvetica',
      color: '#000000',
      hasEOL: true,
    })
  }

  return items
}