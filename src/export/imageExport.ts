import type { Annotation, PageInfo } from '@/types'
import type { PdfEngine } from '@/core/PdfEngine'

export interface RenderPageImageOptions {
  /** factor de escala de alta resolución (1 = 72 dpi, 2 = 144 dpi) */
  scale?: number
  /** formato de salida */
  format?: 'png' | 'jpeg'
  /** calidad JPEG 0-1 (solo jpeg) */
  quality?: number
  /** fondo blanco cuando no hay canvas PDF (página en blanco) */
  fillBlank?: boolean
}

const BOX_TYPES = new Set<Annotation['type']>(['highlight', 'rect', 'sticky', 'stamp', 'signature', 'text'])

function hexToCanvasColor(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}

const FONT_CSS = "'Helvetica Neue', Helvetica, Arial, sans-serif"

/** Dibuja la anotación sobre el contexto 2D con el mismo estilo que el viewer/PDF. */
function drawAnnotationCtx(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  W: number,
  H: number,
): void {
  const x = ann.box.x * W
  const y = ann.box.y * H
  const w = ann.box.width * W
  const h = ann.box.height * H
  const color = hexToCanvasColor(ann.color)
  const sw = Math.max(1, (ann.strokeWidth ?? 0.003) * H)
  const rotDeg = ann.rotation ?? 0

  ctx.save()
  if (rotDeg !== 0 && BOX_TYPES.has(ann.type)) {
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate((rotDeg * Math.PI) / 180)
    ctx.translate(-(x + w / 2), -(y + h / 2))
  }

  switch (ann.type) {
    case 'highlight':
      ctx.fillStyle = color
      ctx.globalAlpha = ann.opacity ?? 0.5
      ctx.fillRect(x, y, w, h)
      break
    case 'rect':
      ctx.strokeStyle = color
      ctx.lineWidth = sw
      ctx.strokeRect(x, y, w, h)
      break
    case 'line':
      ctx.strokeStyle = color
      ctx.lineWidth = sw
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y + h)
      ctx.stroke()
      break
    case 'arrow': {
      const sx = x
      const sy = y
      const ex = x + w
      const ey = y + h
      const dx = ex - sx
      const dy = ey - sy
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const tipLen = Math.min(14, len * 0.12)
      const wing = Math.max(3, tipLen * 0.6)
      ctx.strokeStyle = color
      ctx.lineWidth = sw
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - ux * tipLen - uy * wing, ey - uy * tipLen + ux * wing)
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - ux * tipLen + uy * wing, ey - uy * tipLen - ux * wing)
      ctx.stroke()
      break
    }
    case 'ink': {
      ctx.strokeStyle = color
      ctx.lineWidth = sw
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const pts = ann.points ?? []
      pts.forEach((p, i) => {
        const px = p.x * W
        const py = p.y * H
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
      break
    }
    case 'sticky': {
      ctx.fillStyle = '#fef9c3'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = 'rgba(250,204,21,0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      const fs = Math.max(6, Math.min(12, h * 0.15))
      ctx.fillStyle = '#000000'
      ctx.font = `${fs}px ${FONT_CSS}`
      ctx.textBaseline = 'top'
      ctx.fillText((ann.text ?? '').slice(0, 500), x + 6, y + 5, Math.max(20, w - 12))
      break
    }
    case 'text': {
      const fs = Math.max(8, Math.min(24, h * 0.5))
      ctx.fillStyle = color
      ctx.font = `${fs}px ${FONT_CSS}`
      ctx.textBaseline = 'top'
      ctx.fillText((ann.text ?? '').replace(/\s+/g, ' ').trim(), x, y, Math.max(20, w))
      break
    }
    case 'stamp':
    case 'signature': {
      if (!ann.stampImage) {
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.strokeRect(x, y, w, h)
        break
      }
      void drawStampToCtx(ctx, ann, x, y, w, h, W)
      break
    }
    default:
      break
  }
  ctx.restore()
}

/** Carga la imagen del sello/firma de forma asíncrona (fire-and-forget; el
 *  caller espera con las promesas recogidas). */
async function drawStampToCtx(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  x: number,
  y: number,
  w: number,
  h: number,
  _W: number,
): Promise<void> {
  if (!ann.stampImage) return
  try {
    const img = await loadImage(ann.stampImage)
    ctx.save()
    ctx.globalAlpha = ann.opacity ?? 1
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
  } catch {
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(x, y, w, h)
  }
}

/**
 * Renderiza la página (PDF base + anotaciones visibles) a un canvas de alta
 * resolución. Devuelve el canvas para permitir elegir formato al serializar.
 */
export async function renderPageToCanvasOffscreen(
  engine: PdfEngine,
  page: PageInfo,
  annotations: Annotation[],
  options: RenderPageImageOptions = {},
): Promise<HTMLCanvasElement> {
  const { scale = 2 } = options
  const W = Math.max(1, Math.round(page.width * scale))
  const H = Math.max(1, Math.round(page.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')

  if (!page.blank) {
    try {
      const base = document.createElement('canvas')
      await engine.renderPageToCanvas(page.index, base, scale)
      ctx.drawImage(base, 0, 0)
    } catch {
      // si la página no renderiza (p.ej. rotación especial), dejamos fondo blanco
    }
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }

  const visibles = annotations.filter((a) => a.pageIndex === page.index && !a.hidden)
  const stampTasks: Promise<void>[] = []
  for (const ann of visibles) {
    drawAnnotationCtx(ctx, ann, W, H)
    const isStamp = ann.type === 'stamp' || ann.type === 'signature'
    if (isStamp && ann.stampImage) {
      const x = ann.box.x * W
      const y = ann.box.y * H
      const w = ann.box.width * W
      const h = ann.box.height * H
      stampTasks.push(drawStampToCtx(ctx, ann, x, y, w, h, W))
    }
  }
  await Promise.all(stampTasks)

  void ctx
  return canvas
}

/** Renderiza la página a un Blob de imagen (PNG o JPEG). */
export async function renderPageToBlob(
  engine: PdfEngine,
  page: PageInfo,
  annotations: Annotation[],
  options: RenderPageImageOptions = {},
): Promise<Blob> {
  const { format = 'png', quality = 0.92 } = options
  const canvas = await renderPageToCanvasOffscreen(engine, page, annotations, options)
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo generar la imagen'))
      },
      mime,
      quality,
    )
  })
}

/** Descarga directa de la página actual como imagen. */
export async function downloadPageImage(
  engine: PdfEngine,
  page: PageInfo,
  annotations: Annotation[],
  fileNameBase: string,
  options: RenderPageImageOptions = {},
): Promise<void> {
  const blob = await renderPageToBlob(engine, page, annotations, options)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileNameBase}.${options.format ?? 'png'}`
  a.click()
  URL.revokeObjectURL(url)
}