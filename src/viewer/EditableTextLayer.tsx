import { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { EditedText } from '@/types'
import type { PdfEngine } from '@/core/PdfEngine'

interface EditableTextLayerProps {
  pageIndex: number
  /** dimensiones display del canvas (pixels CSS) */
  width: number
  height: number
  /** zoom aplicado: pixels de display por unidad PDF */
  scale: number
  engine: PdfEngine
}

/**
 * Capa WYSIWYG sobre el canvas PDF (Fase 2).
 * - Extrae items de texto vía pdf.js (una vez por página).
 * - En tool 'text' muestra cajas editables cuyo fondo blanco tapa el texto
 *   original (cover-and-replace) al confirmar un cambio.
 * - Clic = editar in-place; blur guarda el edit en el store para el export.
 */
export function EditableTextLayer({ pageIndex, width, height, scale, engine }: EditableTextLayerProps) {
  const tool = useEditorStore((s) => s.tool)
  const textItems = useEditorStore((s) => s.textItems[pageIndex])
  const document = useEditorStore((s) => s.document)
  const addEdit = useEditorStore((s) => s.addEdit)
  const setTextItems = useEditorStore((s) => s.setTextItems)

  const [editingId, setEditingId] = useState<string | null>(null)

  const edits: EditedText[] = useMemo(
    () => (document?.edits[pageIndex] ?? []).filter((e) => e.pageIndex === pageIndex),
    [document, pageIndex],
  )

  useEffect(() => {
    if (textItems === undefined) {
      void engine
        .getTextItems(pageIndex)
        .then((items) => setTextItems(pageIndex, items))
        .catch(() => {})
    }
  }, [textItems, pageIndex, engine, setTextItems])

  const isEditing = tool === 'text'

  if (!isEditing) return null

  return (
    <div className="pointer-events-none absolute inset-0" data-editable-layer>
      {(textItems ?? []).map((item) => {
        const existing = edits.find((e) => e.itemId === item.id)
        const left = item.box.x * width
        const top = item.box.y * height
        const w = item.box.width * width
        const h = item.box.height * height
        const fontSize = Math.max(6, item.fontSizePx * scale)
        const editing = editingId === item.id

        return (
          <div
            key={item.id}
            className="pointer-events-auto absolute overflow-hidden"
            style={{
              left,
              top,
              width: w,
              height: h,
              boxShadow: editing
                ? '0 0 0 2px #2563eb'
                : '0 0 0 1px rgba(59,130,246,0.35)',
              background: existing || editing ? 'white' : 'rgba(255,255,255,0.55)',
            }}
            title="Clic para editar"
            onPointerDown={(e) => {
              e.stopPropagation()
              setEditingId(item.id)
            }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              className="h-full w-full cursor-text px-[2px] focus:outline-none"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${Math.max(fontSize * 1.2, h)}px`,
                color: item.color,
                fontFamily: 'inherit',
                whiteSpace: 'pre',
                overflow: 'hidden',
              }}
              onBlur={(e) => {
                const newText = e.currentTarget.innerText
                setEditingId(null)
                if (newText.trim() !== item.str.trim()) {
                  addEdit(pageIndex, {
                    itemId: item.id,
                    pageIndex,
                    box: item.box,
                    text: newText.trim(),
                    fontSizePx: item.fontSizePx,
                    fontFamily: item.fontFamily,
                    color: item.color,
                  })
                }
              }}
            />
          </div>
        )
      })}
    </div>
  )
}