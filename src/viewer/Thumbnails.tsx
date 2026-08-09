import { useEffect, useRef, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PdfEngine } from '../core/PdfEngine'
import type { PageInfo } from '../types'

interface ThumbnailProps {
  engine: PdfEngine
  page: PageInfo
  active: boolean
  onClick: () => void
  onDelete: () => void
  onInsertAfter: () => void
}

/** Miniature with on-demand render via IntersectionObserver + sortable drag */
function Thumbnail({ engine, page, active, onClick, onDelete, onInsertAfter }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.index,
  })

  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => setVisible(e.isIntersecting)),
      { rootMargin: '300px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !canvasRef.current) return
    if (page.blank) return
    const canvas = canvasRef.current
    const ac = new AbortController()
    const thumbScale = 120 / page.width
    void engine.renderPageToCanvas(page.index, canvas, thumbScale, ac.signal)
    return () => ac.abort()
  }, [engine, page, visible])

  return (
    <div ref={holderRef} className="group" style={{ position: 'relative' }}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        {...listeners}
      >
        <button
          onClick={onClick}
          className={`relative block w-full overflow-hidden rounded border bg-white transition ${
            isDragging
              ? 'z-10 opacity-80 shadow-xl ring-2 ring-blue-400'
              : active
                ? 'border-blue-500 ring-2 ring-blue-300'
                : 'border-neutral-200 hover:border-neutral-400'
          }`}
          title={`Página ${page.index + 1}`}
          style={{ aspectRatio: `${page.width} / ${page.height}`, cursor: 'grab', touchAction: 'none' }}
        >
          <canvas ref={canvasRef} className="absolute inset-0" />
          {page.blank && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-neutral-400">
              En blanco
            </span>
          )}
          {page.index > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="absolute right-0 top-0 z-10 hidden cursor-pointer rounded-bl bg-red-500 px-1 text-[10px] text-white group-hover:block"
              title="Eliminar página"
            >
              ✕
            </span>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onInsertAfter()
          }}
          className="absolute -bottom-2 left-1/2 z-10 hidden -translate-x-1/2 cursor-pointer rounded border border-neutral-300 bg-white px-2 py-0.5 text-[10px] leading-none text-neutral-500 shadow hover:bg-blue-50 group-hover:block"
          title="Insertar página en blanco después"
        >
          +
        </button>
      </div>
    </div>
  )
}

export function Thumbnails({
  engine,
  pages,
  activeIndex,
  onSelect,
  onReorder,
  onInsertAfter,
  onDelete,
}: {
  engine: PdfEngine
  pages: PageInfo[]
  activeIndex: number
  onSelect: (i: number) => void
  onReorder: (order: number[]) => void
  onInsertAfter: (i: number) => void
  onDelete: (i: number) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pages.findIndex((p) => p.index === active.id)
    const newIndex = pages.findIndex((p) => p.index === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(pages, oldIndex, newIndex)
    onReorder(next.map((p) => p.index))
  }

  return (
    <aside className="w-40 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.index)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {pages.map((page, i) => (
              <Thumbnail
                key={page.index}
                engine={engine}
                page={page}
                active={page.index === activeIndex}
                onClick={() => onSelect(page.index)}
                onInsertAfter={() => onInsertAfter(i)}
                onDelete={() => onDelete(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="mt-3 text-center text-xs text-neutral-400">
        {pages.length} páginas
      </div>
    </aside>
  )
}