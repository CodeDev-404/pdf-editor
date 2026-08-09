import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { pdfjsLib } from './pdfWorker'
import type { PageInfo } from '../types'
import type { TextItem } from '../types'
import { ViewTransform } from './transforms'

interface RawTextItem {
  str: string
  transform: number[]
  width: number
  height?: number
  hasEOL?: boolean
}

export class PdfEngine {
  private doc: PDFDocumentProxy | null = null
  private loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null
  private renderTasks = new Set<RenderTask>()
  private sourceBytes: Uint8Array | null = null

  static async create(source: ArrayBuffer | Uint8Array): Promise<PdfEngine> {
    const engine = new PdfEngine()
    await engine.load(source)
    return engine
  }

  async load(source: ArrayBuffer | Uint8Array): Promise<void> {
    if (source instanceof ArrayBuffer) source = new Uint8Array(source)
    this.sourceBytes = source
    this.doc?.cleanup()
    const task = pdfjsLib.getDocument({ data: source })
    this.doc = await task.promise
    this.loadingTask = task
  }

  get bytes(): Uint8Array | null {
    return this.sourceBytes
  }

  get pageCount(): number {
    return this.doc?.numPages ?? 0
  }

  get documentProxy(): PDFDocumentProxy | null {
    return this.doc
  }

  async getPageInfo(index: number): Promise<PageInfo> {
    const doc = this.requireDoc()
    const page = await doc.getPage(index + 1)
    const viewport = page.getViewport({ scale: 1 })
    const info: PageInfo = {
      index,
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate,
    }
    void page.cleanup()
    return info
  }

  async renderPageToCanvas(
    index: number,
    canvas: HTMLCanvasElement,
    scale: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const doc = this.requireDoc()
    const page = await doc.getPage(index + 1)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const viewport = page.getViewport({ scale: scale * dpr })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${viewport.width / dpr}px`
    canvas.style.height = `${viewport.height / dpr}px`

    const renderTask = page.render({ canvas, viewport })
    this.renderTasks.add(renderTask)

    const onAbort = () => renderTask.cancel()
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      await renderTask.promise
    } finally {
      this.renderTasks.delete(renderTask)
      signal?.removeEventListener('abort', onAbort)
      void page.cleanup()
    }
  }

/** Devuelve los items de texto de la página con su caja normalizada [0,1] */
  async getTextItems(index: number): Promise<TextItem[]> {
    const doc = this.requireDoc()
    const page = await doc.getPage(index + 1)
    const content = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })
    const transform = new ViewTransform(viewport.width, viewport.height)

    const rawItems = content.items.filter(
      (item) => 'str' in item && typeof (item as RawTextItem).str === 'string',
    ) as RawTextItem[]

    const items: TextItem[] = rawItems
      .filter((item) => item.str.length > 0)
      .map((item, i) => {
        const [a, b, , d, e, f] = item.transform
        const x = e
        const y = f
        const width = item.width
        const height = item.height ?? Math.abs(d)
        const boxNorm = transform.pdfToNormalized(x, y, width, height)
        const fontSize = Math.hypot(a, b)
        return {
          id: `text-${index}-${i}`,
          pageIndex: index,
          str: item.str,
          box: boxNorm,
          fontSizePx: fontSize,
          fontFamily: '',
          color: '#000000',
          hasEOL: Boolean(item.hasEOL),
        }
      })
      .filter((item) => item.str.trim().length > 0)

    void page.cleanup()
    return items
  }

  async exportBytes(): Promise<Uint8Array> {
    const doc = this.requireDoc()
    const data = await doc.saveDocument()
    return new Uint8Array(data)
  }

  destroy(): void {
    for (const task of this.renderTasks) task.cancel()
    this.renderTasks.clear()
    this.doc?.cleanup()
    void this.loadingTask?.destroy()
    this.doc = null
    this.loadingTask = null
  }

  private requireDoc(): PDFDocumentProxy {
    if (!this.doc) throw new Error('Documento no cargado')
    return this.doc
  }
}