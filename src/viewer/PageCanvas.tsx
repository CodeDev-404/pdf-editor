import { useEffect, useRef, useState } from 'react'
import { EditableTextLayer } from './EditableTextLayer'
import { AnnotationLayer } from '@/annotate/AnnotationLayer'
import { SearchOverlay } from './SearchOverlay'
import { useEditorStore } from '@/store/editorStore'
import type { PdfEngine } from '@/core/PdfEngine'
import type { PageInfo } from '@/types'

interface PageCanvasProps {
  engine: PdfEngine
  page: PageInfo
  scale: number
  width: number
  height: number
}

/**
 * Página individual: renderiza el canvas PDF cuando entra en el viewport
 * (IntersectionObserver) y monta la capa WYSIWYG encima.
 */
export function PageCanvas({ engine, page, scale, width, height }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const pageIndex = page.index
  const tool = useEditorStore((s) => s.tool)
  const setActivePage = useEditorStore((s) => s.setActivePage)

  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setVisible(entry.isIntersecting)
          if (entry.isIntersecting) setActivePage(pageIndex)
        }
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [pageIndex, setActivePage])

  useEffect(() => {
    if (!visible || !canvasRef.current) return
    if (page.blank) return
    const canvas = canvasRef.current
    canvas.width = 0
    canvas.height = 0
    const ac = new AbortController()
    void engine.renderPageToCanvas(pageIndex, canvas, scale, ac.signal).catch(() => {})
    return () => ac.abort()
  }, [engine, pageIndex, scale, visible, page.blank])

  return (
    <div ref={holderRef} data-search-row={pageIndex} className="relative bg-white shadow">
      <div style={{ width, height, background: page.blank ? '#ffffff' : undefined }}>
        <canvas
          ref={canvasRef}
          style={{ width: `${width}px`, height: `${height}px`, display: 'block' }}
        />
        <SearchOverlay pageIndex={pageIndex} width={width} height={height} />
        {tool === 'text' && (
          <EditableTextLayer
            engine={engine}
            pageIndex={pageIndex}
            width={width}
            height={height}
            scale={scale}
          />
        )}
        <AnnotationLayer pageIndex={pageIndex} width={width} height={height} />
      </div>
    </div>
  )
}