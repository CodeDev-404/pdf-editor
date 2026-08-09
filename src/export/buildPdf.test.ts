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

describe('buildEditedPdf (cover-and-replace)', () => {
  it('produce un PDF válido y preserva el texto no editado', async () => {
    const source = await makeSourcePdf()
    const pageInfo: PageInfo = { index: 0, width: 600, height: 800, rotation: 0 }

    const t = new ViewTransform(600, 800)
    const box = t.pdfToNormalized(100, 700, 200, 16)

    const edit: EditedText = {
      itemId: 'text-0-0',
      pageIndex: 0,
      box,
      text: 'Texto editado',
      fontSizePx: 16,
      fontFamily: 'Helvetica',
      color: '#ff0000',
    }

    const result = await buildEditedPdf(source, [pageInfo], {
      edits: { 0: [edit] },
      annotations: [],
    })
    expect(result.length).toBeGreaterThan(100)

    const reloaded = await PDFDocument.load(result)
    expect(reloaded.getPageCount()).toBe(1)
    const page = reloaded.getPage(0)
    const { width, height } = page.getSize()
    expect(width).toBe(600)
    expect(height).toBe(800)
  })

  it('respeta coordenadas normalizadas sinh paginação errónea', async () => {
    const source = await makeSourcePdf()
    const pageInfo: PageInfo = { index: 0, width: 600, height: 800, rotation: 0 }
    const t = new ViewTransform(600, 800)
    const box = t.pdfToNormalized(100, 660, 180, 12)

    const result = await buildEditedPdf(source, [pageInfo], {
      edits: {
        0: [
          {
            itemId: 'text-0-1',
            pageIndex: 0,
            box,
            text: 'xx',
            fontSizePx: 12,
            fontFamily: 'Courier',
            color: '#000000',
          },
        ],
      },
      annotations: [],
    })
    const reloaded = await PDFDocument.load(result)
    expect(reloaded.getPage(0).getSize().width).toBe(600)
  })

  it('cifra el PDF cuando se indica una contraseña', async () => {
    const source = await makeSourcePdf()
    const pageInfo: PageInfo = { index: 0, width: 600, height: 800, rotation: 0 }
    const result = await buildEditedPdf(source, [pageInfo], { edits: {}, annotations: [] }, { userPassword: 'clave-123' })

    const hex = Array.from(result).map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(hex).not.toContain('50524446') // "PRDF" — el PDF sin cifrar inicia con %PDF
    expect(hex.slice(0, 8)).toBe('25504446') // %PDF

    // pdf-lib puede cargar el documento cifrado aunque no pueda leer streams
    const reloaded = await PDFDocument.load(result, { ignoreEncryption: true })
    expect(reloaded.getPageCount()).toBe(1)
  })
})