import { useRef, useState } from 'react'
import { Stage, Layer, Rect, Line, Arrow, Text, Image } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '@/store/editorStore'
import type { Annotation, Tool } from '@/types'

interface AnnotationLayerProps {
  pageIndex: number
  width: number
  height: number
}

const DRAW_TOOLS: Tool[] = ['highlight', 'rectangle', 'line', 'arrow', 'ink', 'sticky']

function strokeWidthPx(strokeWidth: number | undefined, height: number): number {
  return Math.max(1, (strokeWidth ?? 0.005) * height)
}

function makePoints(ann: Annotation, width: number, height: number): number[] {
  const pts: number[] = []
  for (const p of ann.points ?? []) pts.push(p.x * width, p.y * height)
  return pts
}

interface AnnShapeProps {
  ann: Annotation
  width: number
  height: number
  draggable: boolean
  selected?: boolean
  onDragEnd?: (ann: Annotation) => void
  onSelect?: (ann: Annotation) => void
}

function AnnShape({ ann, width, height, draggable, selected, onDragEnd, onSelect }: AnnShapeProps) {
  const sw = strokeWidthPx(ann.strokeWidth, height)
  const color = ann.color

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const nx = Math.min(1, Math.max(0, e.target.x() / width))
    const ny = Math.min(1, Math.max(0, e.target.y() / height))
    onDragEnd?.({ ...ann, box: { ...ann.box, x: nx, y: ny } })
  }

  const commonProps = {
    x: ann.box.x * width,
    y: ann.box.y * height,
    draggable,
    onDragEnd: draggable ? handleDragEnd : undefined,
    onClick: onSelect ? () => onSelect(ann) : undefined,
    onTap: onSelect ? () => onSelect(ann) : undefined,
    /** borde de selección */
    ...(selected ? { shadowColor: 'rgba(37,99,235,0.9)', shadowBlur: 6, shadowOpacity: 1 } : {}),
  }

  switch (ann.type) {
    case 'highlight':
      return (
        <Rect
          width={ann.box.width * width}
          height={ann.box.height * height}
          fill={color}
          opacity={ann.opacity ?? 0.5}
          {...commonProps}
        />
      )
    case 'rect':
      return (
        <Rect
          width={ann.box.width * width}
          height={ann.box.height * height}
          stroke={color}
          strokeWidth={sw}
          strokeScaleEnabled={false}
          {...commonProps}
        />
      )
    case 'line':
      return (
        <Line
          points={[
            ann.box.x * width,
            ann.box.y * height,
            (ann.box.x + ann.box.width) * width,
            (ann.box.y + ann.box.height) * height,
          ]}
          stroke={color}
          strokeWidth={sw}
          {...commonProps}
        />
      )
    case 'arrow':
      return (
        <Arrow
          points={[
            ann.box.x * width,
            ann.box.y * height,
            (ann.box.x + ann.box.width) * width,
            (ann.box.y + ann.box.height) * height,
          ]}
          stroke={color}
          strokeWidth={sw}
          pointerLength={Math.max(8, sw * 3)}
          pointerWidth={Math.max(6, sw * 2)}
          {...commonProps}
        />
      )
    case 'ink':
      return (
        <Line
          points={makePoints(ann, width, height)}
          stroke={color}
          strokeWidth={sw}
          lineCap="round"
          lineJoin="round"
          {...commonProps}
        />
      )
    case 'sticky':
      return (
        <Text
          width={Math.max(40, ann.box.width * width)}
          height={Math.max(30, ann.box.height * height)}
          text={ann.text ?? ''}
          fill="#fef9c3"
          fontFamily="Arial"
          fontSize={14}
          padding={6}
          wrap="word"
          {...commonProps}
        />
      )
    case 'stamp':
    case 'signature': {
      const boxProps = {
        width: ann.box.width * width,
        height: ann.box.height * height,
        ...commonProps,
      }
      if (!ann.stampImage) {
        return (
          <Rect stroke="#94a3b8" strokeWidth={1} dash={[4, 4]} {...boxProps} />
        )
      }
      return (
        <StampedImage
          ann={ann}
          width={width}
          height={height}
          draggable={draggable}
          onDragEnd={onDragEnd}
        />
      )
    }
    default:
      return null
  }
}

function StampedImage({
  ann,
  width,
  height,
  draggable,
  onDragEnd,
}: {
  ann: Annotation
  width: number
  height: number
  draggable: boolean
  onDragEnd?: (ann: Annotation) => void
}) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  if (!imageRef.current && ann.stampImage) {
    const img = new window.Image()
    img.src = ann.stampImage
    imageRef.current = img
  }

  return (
    <Image
      image={imageRef.current ?? undefined}
      x={ann.box.x * width}
      y={ann.box.y * height}
      width={ann.box.width * width}
      height={ann.box.height * height}
      draggable={draggable}
      onDragEnd={
        draggable
          ? (e) => {
              const nx = Math.min(1, Math.max(0, e.target.x() / width))
              const ny = Math.min(1, Math.max(0, e.target.y() / height))
              onDragEnd?.({ ...ann, box: { ...ann.box, x: nx, y: ny } })
            }
          : undefined
      }
    />
  )
}

/**
 * Capa de anotaciones Konva sobre cada página (Fase 3).
 * - Tool 'select': seleccionar/mover anotaciones (clic en una seleccionada la borra).
 * - Tools de dibujo: highlight, rect, línea, flecha e ink.
 * - Las anotaciones se guardan en el store y se exportan al PDF.
 */
export function AnnotationLayer({ pageIndex, width, height }: AnnotationLayerProps) {
  const tool = useEditorStore((s) => s.tool)
  const annotations = useEditorStore((s) => s.document?.annotations ?? [])
  const addAnnotation = useEditorStore((s) => s.addAnnotation)
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation)
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation)
  const strokeProps = useEditorStore((s) => s.strokeProps)

  const [draft, setDraft] = useState<Annotation | null>(null)
  const [drawingActive, setDrawingActive] = useState(false)
  const [editing, setEditing] = useState<{ ann: Annotation; text: string } | null>(null)
  const inkPointsRef = useRef<Array<{ x: number; y: number }>>([])
  const selection = useEditorStore((s) => s.selection)
  const setSelection = useEditorStore((s) => s.setSelection)
  const selectedId =
    selection?.type === 'annotation' && selection.pageIndex === pageIndex ? selection.id ?? null : null

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex)
  const drawing = DRAW_TOOLS.includes(tool)
  const isSelect = tool === 'select'
  const interactive = drawing || isSelect

  const relativePoint = (e: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage()
    return stage?.getRelativePointerPosition() ?? null
  }

  const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!drawing) return
    const p = relativePoint(e)
    if (!p) return
    setDrawingActive(true)
    inkPointsRef.current = [p]
    if (tool === 'sticky') {
      setDraft({
        id: `ann-${Date.now()}`,
        pageIndex,
        type: 'sticky',
        color: '#fde047',
        strokeWidth: 0.0025,
        opacity: 1,
        text: '',
        box: { x: p.x / width, y: p.y / height, width: 0.16, height: 0.09 },
      })
      return
    }
    setDraft({
      id: `ann-${Date.now()}`,
      pageIndex,
      type: tool as Annotation['type'],
      color: tool === 'highlight' ? '#fde047' : strokeProps.color,
      strokeWidth: tool === 'highlight' ? 0.01 : strokeProps.strokeWidth,
      opacity: tool === 'highlight' ? 0.55 : strokeProps.opacity,
      box: { x: p.x / width, y: p.y / height, width: 0, height: 0 },
      points: tool === 'ink' ? [p] : undefined,
    })
  }

  const onMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!drawingActive || !draft) return
    const p = relativePoint(e)
    if (!p) return

    if (draft.type === 'ink') {
      inkPointsRef.current = [...inkPointsRef.current, p]
      setDraft({
        ...draft,
        box: {
          x: Math.min(draft.box.x, p.x / width),
          y: Math.min(draft.box.y, p.y / height),
          width: 0,
          height: 0,
        },
        points: [...inkPointsRef.current],
      })
      return
    }

    const nx = Math.min(1, Math.max(0, p.x / width))
    const ny = Math.min(1, Math.max(0, p.y / height))
    setDraft({
      ...draft,
      box: {
        x: Math.min(draft.box.x, nx),
        y: Math.min(draft.box.y, ny),
        width: Math.abs(nx - draft.box.x),
        height: Math.abs(ny - draft.box.y),
      },
    })
  }

  const onUp = () => {
    if (!drawingActive || !draft) return
    setDrawingActive(false)

    if (draft.type === 'ink') {
      const pts = inkPointsRef.current
      if (pts.length < 2) {
        setDraft(null)
        return
      }
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      addAnnotation({
        ...draft,
        box: {
          x: Math.min(...xs) / width,
          y: Math.min(...ys) / height,
          width: (Math.max(...xs) - Math.min(...xs)) / width,
          height: (Math.max(...ys) - Math.min(...ys)) / height,
        },
        points: pts,
      })
      setDraft(null)
      return
    }

    if (draft.box.width < 0.005 || draft.box.height < 0.005) {
      setDraft(null)
      return
    }

    const sticky = draft.type === 'sticky'
    const newAnn: Annotation = {
      ...draft,
      text: draft.text ?? '',
      box: sticky
        ? {
            x: Math.min(1 - 0.16, Math.max(0, draft.box.x)),
            y: Math.min(1 - 0.09, Math.max(0, draft.box.y)),
            width: 0.16,
            height: 0.09,
          }
        : draft.box,
    }
    addAnnotation(newAnn)
    setDraft(null)
    if (sticky) setEditing({ ann: newAnn, text: newAnn.text ?? '' })
  }

  const handleClick = (ann: Annotation) => {
    if (!isSelect) return
    if (selectedId === ann.id) {
      removeAnnotation(ann.id)
      setSelection(null)
    } else {
      setSelection({ pageIndex, type: 'annotation', id: ann.id })
    }
  }

  const editingSticky = editing?.ann.type === 'sticky'

  return (
    <div className="absolute inset-0 z-10">
      <Stage
        className="absolute left-0 top-0 z-10"
        width={width}
        height={height}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{ pointerEvents: interactive && !editingSticky ? 'auto' : 'none', touchAction: 'none' }}
      >
        <Layer listening={interactive}>
          {pageAnnotations.map((ann) => (
            <AnnShape
              key={ann.id}
              ann={ann}
              width={width}
              height={height}
              draggable={isSelect}
              selected={selectedId === ann.id}
              onDragEnd={(a) => updateAnnotation(a)}
              onSelect={handleClick}
            />
          ))}
          {draft && <AnnShape ann={draft} width={width} height={height} draggable={false} />}
        </Layer>
      </Stage>

      {editingSticky && editing && (
        <textarea
          autoFocus
          value={editing.text}
          onChange={(e) => setEditing({ ann: editing.ann, text: e.target.value })}
          onBlur={() => {
            updateAnnotation({ ...editing.ann, text: editing.text })
            setEditing(null)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') setEditing(null)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute z-20 resize-none overflow-hidden rounded-sm bg-[#fef9c3] px-1.5 py-1 font-sans text-sm leading-snug text-neutral-800 shadow outline-none ring-2 ring-blue-500"
          style={{
            left: editing.ann.box.x * width,
            top: editing.ann.box.y * height,
            width: editing.ann.box.width * width,
            height: editing.ann.box.height * height,
          }}
        />
      )}
    </div>
  )
}

export default AnnotationLayer