import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { pushGraphicsState, popGraphicsState, translate, rotateDegrees } from 'pdf-lib'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt'
import { ViewTransform } from '@/core/transforms'
import type { Annotation, EditedText, PageInfo } from '@/types'

const FONT_ALIASES: Record<string, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  Arial: StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  Times: StandardFonts.TimesRoman,
  'Times New Roman': StandardFonts.TimesRoman,
  Georgia: StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier,
  'Courier New': StandardFonts.Courier,
  monospace: StandardFonts.Courier,
}

const BOX_TYPES = new Set<Annotation['type']>(['highlight', 'rect', 'sticky', 'stamp', 'signature', 'text'])

function pickFont(family: string): StandardFonts {
  if (!family) return StandardFonts.Helvetica
  if (family.toLowerCase().includes('bold')) return StandardFonts.HelveticaBold
  return FONT_ALIASES[family] ?? StandardFonts.Helvetica
}

function hexToRgb(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return rgb(0, 0, 0)
  const n = parseInt(match[1], 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  return rgb(r, g, b)
}

/** Tapa el texto original con rectángulo blanco y dibuja el nuevo. */
function coverReplaceOnPage(
  page: PDFPage,
  pageInfo: PageInfo,
  edits: EditedText[],
): PDFPage {
  const { width: W, height: H } = page.getSize()
  const t = new ViewTransform(W, H)
  const fontCache = new Map<string, PDFFont>()

  const getFont = (family: string) => {
    let font = fontCache.get(family)
    if (!font) {
      font = page.doc.embedStandardFont(pickFont(family))
      fontCache.set(family, font)
    }
    return font
  }

  for (const edit of edits) {
    const { x, y, width, height } = t.normalizedToPdf(edit.box)
    const font = getFont(edit.fontFamily)
    const fontSize = edit.fontSizePx * (pageInfo.width / W)

    const padX = 1
    const padTop = 1.5
    const padBottom = 3
    page.drawRectangle({
      x: Math.max(0, x - padX),
      y: Math.max(0, y + height - padBottom),
      width: Math.min(W, width + padX * 2),
      height: Math.min(H, height + padTop + padBottom),
      color: rgb(1, 1, 1),
    })

    page.drawText(edit.text, {
      x: Math.max(0, x),
      y: Math.max(0, y),
      size: fontSize,
      font,
      color: hexToRgb(edit.color),
    })
  }

  return page
}

/** Dibuja una anotación (highlight, rect, línea, flecha, ink, sticky) como vectores PDF. */
async function drawAnnotationOnPage(
  page: PDFPage,
  ann: Annotation,
  font: PDFFont,
): Promise<PDFPage> {
  const { width: W, height: H } = page.getSize()
  const t = new ViewTransform(W, H)
  const { x, y, width, height } = t.normalizedToPdf(ann.box)
  const color = hexToRgb(ann.color)
  const sw = (ann.strokeWidth ?? 0.003) * H
  const rotDeg = ann.rotation ?? 0
  const applyRotation = rotDeg !== 0 && BOX_TYPES.has(ann.type)
  if (applyRotation) {
    const cx = x + width / 2
    const cy = y - height / 2
    page.pushOperators(pushGraphicsState(), translate(cx, cy), rotateDegrees(rotDeg), translate(-cx, -cy))
  }

  switch (ann.type) {
    case 'highlight':
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        color: hexToRgb(ann.color),
        opacity: ann.opacity ?? 0.5,
      })
      break
    case 'rect':
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        borderColor: color,
        borderWidth: Math.max(1, sw),
        opacity: ann.opacity ?? 1,
      })
      break
    case 'line':
      page.drawLine({
        start: { x, y },
        end: { x: x + width, y: y - height },
        thickness: Math.max(1, sw),
        color,
      })
      break
    case 'arrow': {
      const dx = x + width - x
      const dy = y - height - y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const tipLen = Math.min(14, len * 0.12)
      const ex = x + width
      const ey = y - height
      page.drawLine({ start: { x, y }, end: { x: ex, y: ey }, thickness: Math.max(1, sw), color })
      const wing = Math.max(3, tipLen * 0.6)
      page.drawLine({
        start: { x: ex, y: ey },
        end: { x: ex - ux * tipLen - uy * wing, y: ey - uy * tipLen + ux * wing },
        thickness: Math.max(1, sw),
        color,
      })
      page.drawLine({
        start: { x: ex, y: ey },
        end: { x: ex - ux * tipLen + uy * wing, y: ey - uy * tipLen - ux * wing },
        thickness: Math.max(1, sw),
        color,
      })
      break
    }
    case 'ink': {
      const pts = (ann.points ?? []).map((p) => ({
        x: p.x * W,
        y: H - p.y * H,
      }))
      for (let i = 1; i < pts.length; i++) {
        page.drawLine({
          start: pts[i - 1],
          end: pts[i],
          thickness: Math.max(1, sw),
          color,
        })
      }
      break
    }
    case 'sticky':
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        color: rgb(1, 0.976, 0.773),
        borderColor: rgb(0.98, 0.85, 0.25),
        borderWidth: 1,
      })
      page.drawText(ann.text ?? '', {
        x: x + 4,
        y: y - height + 4,
        size: Math.max(6, Math.min(12, height * 0.15)),
        color: rgb(0, 0, 0),
        font,
      })
      break
    case 'text':
      page.drawText(ann.text ?? '', {
        x,
        y: y - 12,
        size: Math.max(8, Math.min(24, height * 0.5)),
        color,
        font,
      })
      break
    case 'stamp':
    case 'signature': {
      if (!ann.stampImage || !ann.stampImage.startsWith('data:image')) break
      const base64 = ann.stampImage.split(',')[1]
      if (!base64) break
      const img = await page.doc.embedPng(base64ToBytes(base64))
      page.drawImage(img, {
        x,
        y: y - height,
        width,
        height,
        opacity: ann.opacity ?? 1,
      })
      break
    }
    default:
      break
  }

  if (applyRotation) {
    page.pushOperators(popGraphicsState())
  }
  return page
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atobCompat(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function atobCompat(b64: string): string {
  if (typeof globalThis.atob === 'function') return globalThis.atob(b64)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let buffer = 0
  let bits = 0
  for (const c of b64) {
    if (c === '=') break
    const idx = chars.indexOf(c)
    if (idx === -1) continue
    buffer = (buffer << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      result += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }
  return result
}

export interface ExportOptions {
  /** escala a aplicar a todo el documento (1 = 100%) */
  scale?: number
  /** incluir anotaciones en el export */
  includeAnnotations?: boolean
  /** aplicar ediciones de texto cover-and-replace */
  includeEdits?: boolean
  /** usar object streams (≈ compresión estructural) */
  compressed?: boolean
  /** contraseña de apertura (cifra el PDF) */
  userPassword?: string
  /** contraseña de propietario (restricciones); se deriva de userPassword si no se da */
  ownerPassword?: string
}

/**
 * Exporta el PDF aplicando ediciones cover-and-replace y anotaciones.
 * - Los bloques editados se tapan (blanco) y se escriben con texto nuevo.
 * - Highlight/rect/line/arrow/ink/sticky se dibujan como vectores.
 * - Sellos y firmas se incrustan como imágenes PNG.
 * - El resto del documento queda intacto.
 */
export async function buildEditedPdf(
  sourceBytes: Uint8Array,
  pageInfos: PageInfo[],
  state: { edits: Record<number, EditedText[]>; annotations: Annotation[] },
  options: ExportOptions = {},
): Promise<Uint8Array> {
  const {
    scale = 1,
    includeAnnotations = true,
    includeEdits = true,
    compressed = true,
    userPassword,
    ownerPassword,
  } = options
  const { edits, annotations } = state

  const src = await PDFDocument.load(sourceBytes)
  const font = await src.embedFont(StandardFonts.Helvetica)

  // Construye el PDF de salida en el orden de visualización (Fase 6.5).
  // Cada PageInfo guarda su índice físico original (`page.index`); una página
  // `blank` no existe en el fuente y se crea como página en blanco nueva.
  const output = await PDFDocument.create()

  // outputPosition[maps físico] -> posición en el PDF de salida
  const physicalToOutput = new Map<number, number>()
  const sourcePhysicalToSource = (physIdx: number) => src.getPage(physIdx)

  // Pre-copia las páginas fuente no-blank conservando su contenido.
  const nonBlankPhys = pageInfos.filter((p) => !p.blank).map((p) => p.index)
  const copiedNonBlank = await output.copyPages(src, nonBlankPhys)
  let copyCursor = 0

  for (const pageInfo of pageInfos) {
    if (pageInfo.blank) {
      // Página en blanco nueva: se crea con las mismas dimensiones.
      output.addPage([pageInfo.width, pageInfo.height])
      physicalToOutput.set(pageInfo.index, output.getPageCount() - 1)
    } else {
      output.addPage(copiedNonBlank[copyCursor] ?? sourcePhysicalToSource(pageInfo.index))
      physicalToOutput.set(pageInfo.index, output.getPageCount() - 1)
      copyCursor++
    }
  }
  const pdf = output

  // Mapa índice físico -> PageInfo del array de visualización
  const physicalToPageInfo = new Map(pageInfos.map((p) => [p.index, p]))

  for (const [indexStr, pageEdits] of Object.entries(edits)) {
    const pageIndex = Number(indexStr)
    if (!pageEdits.length) continue
    const pageInfo = physicalToPageInfo.get(pageIndex)
    if (!pageInfo) continue
    if (pageInfo.rotation) continue
    if (!includeEdits) continue
    const outIndex = physicalToOutput.get(pageIndex)
    if (outIndex === undefined) continue
    coverReplaceOnPage(pdf.getPage(outIndex), pageInfo, pageEdits)
  }

  if (includeAnnotations) {
    const byPage = new Map<number, Annotation[]>()
    for (const ann of annotations) {
      if (ann.hidden) continue
      const list = byPage.get(ann.pageIndex) ?? []
      list.push(ann)
      byPage.set(ann.pageIndex, list)
    }

    for (const [pageIndex, pageAnns] of byPage) {
      const pageInfo = physicalToPageInfo.get(pageIndex)
      if (!pageInfo || pageInfo.rotation) continue
      const outIndex = physicalToOutput.get(pageIndex)
      if (outIndex === undefined || outIndex >= pdf.getPageCount()) continue
      const pdfPage = pdf.getPage(outIndex)
      for (const ann of pageAnns) {
        await drawAnnotationOnPage(pdfPage, ann, font)
      }
    }
  }

  if (scale !== 1) {
    for (let i = 0; i < pdf.getPageCount(); i++) {
      pdf.getPage(i).scale(scale, scale)
    }
  }

  // Cifrado opcional (Fase 7.5): @pdfsmaller/pdf-encrypt aplica RC4 128-bit
  // sobre los bytes serializados, sin necesitar el diccionario /Encrypt que
  // pdf-lib no puede emitir.
  const pwd = userPassword
  const owner = ownerPassword || userPassword
  let bytes = await pdf.save({ useObjectStreams: compressed })
  if (pwd) {
    bytes = await encryptPDF(bytes, pwd, {
      ownerPassword: owner,
      algorithm: 'RC4',
      allowPrinting: true,
      allowHighQualityPrint: true,
      allowExtraction: true,
      allowModifying: false,
      allowCopying: false,
      allowAnnotating: false,
      allowFillingForms: false,
      allowAssembly: false,
    })
  }
  return bytes
}