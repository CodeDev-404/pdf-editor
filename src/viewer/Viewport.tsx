import { useEffect, useMemo, useRef } from 'react'
import { PageCanvas } from './PageCanvas'
import { useEditorStore } from '@/store/editorStore'
import type { PdfEngine } from '@/core/PdfEngine'
import type { PageInfo } from '@/types'

interface ViewportProps {
  engine: PdfEngine
  pages: PageInfo[]
}

const PADDING = 24

/**
 * Scroll vertical virtualizado: cada página renderiza on-demand
 * vía IntersectionObserver. Soporta zoom manual + fit de ancho/alto.
 */
export function Viewport({ engine, pages }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const zoom = useEditorStore((s) => s.zoom)
  const zoomMode = useEditorStore((s) => s.zoomMode)
  const setZoom = useEditorStore((s) => s.setZoom)

  const activePage = pages[0]

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      if (zoomMode !== 'custom' && activePage) {
        const usable = el.clientWidth - PADDING * 2 - 48
        const scale =
          zoomMode === 'fitWidth'
            ? usable / activePage.width
            : Math.min(usable / activePage.width, (el.clientHeight - 120) / activePage.height)
        setZoom(Math.max(0.1, Number(scale.toFixed(3))))
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [zoomMode, activePage, setZoom])

  const scaled = useMemo(
    () =>
      pages.map((page) => ({
        page,
        width: Math.round(page.width * zoom),
        height: Math.round(page.height * zoom),
      })),
    [pages, zoom],
  )

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-neutral-200" data-viewport>
      <div
        className="mx-auto flex flex-col px-6 py-4"
        style={{ width: 'fit-content', minWidth: '100%' }}
      >
        {scaled.map(({ page, width, height }) => (
          <div key={page.index} style={{ paddingBottom: PADDING }}>
            <PageCanvas engine={engine} page={page} scale={zoom} width={width} height={height} />
          </div>
        ))}
      </div>
    </div>
  )
}