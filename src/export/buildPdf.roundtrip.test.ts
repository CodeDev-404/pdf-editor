import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { buildEditedPdf } from './buildPdf'
import { ViewTransform } from '@/core/transforms'
import type { EditedText, PageInfo } from '@/types'

async function makeSourcePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([600, 800])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('Hola mundo original', { x: 100, y: 700, size: 16, font })
  page.drawText('Segunda linea intacta', { x: 100, y: 660, size: 12, font })
  return pdf.save()
}

async function extractTextWithPdfjs(bytes: Uint8Array): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() })
  const doc = await loadingTask.promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()
  const lines = content.items
    .filter((it) => 'str' in it)
    .map((it) => (it as { str: string }).str)
  void page.cleanup()
  await loadingTask.destroy()
  return lines
}

describe('buildEditedPdf (cover-and-replace) round-trip', () => {
  it('texto editado presente, texto no editado preservado', async () => {
    const source = await makeSourcePdf()
    const pageInfo: PageInfo = { index: 0, width: 600, height: 800, rotation: 0 }

    const t = new ViewTransform(600, 800)
    const box1 = t.pdfToNormalized(100, 700, 200, 16)

    const edit: EditedText = {
      itemId: 'text-0-0',
      pageIndex: 0,
      box: box1,
      text: 'TEXTO EDITADO NUEVO',
      fontSizePx: 16,
      fontFamily: 'Helvetica',
      color: '#ff0000',
    }

    const result = await buildEditedPdf(source, [pageInfo], {
      edits: { 0: [edit] },
      annotations: [],
    })

    const reloaded = await PDFDocument.load(result)
    expect(reloaded.getPageCount()).toBe(1)

    const strings = await extractTextWithPdfjs(result)
    const all = strings.join(' ')
    expect(all).toContain('TEXTO EDITADO NUEVO')
    // la segunda línea no fue editada y debe seguir presente
    expect(all).toContain('Segunda')
    expect(all).toContain('intacta')
  })
})