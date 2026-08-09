import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Rect, Line, Arrow, Text, Image, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useEditorStore } from '@/store/editorStore'
import type { Annotation, Tool } from '@/types'

interface AnnotationLayerProps {
  pageIndex: number
  width: number
  height: number
}

const DRAW_TOOLS: Tool[] = ['highlight', 'rectangle', 'line', 'arrow', 'ink', 'sticky', 'newtext']

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
  nodeRef?: (node: Konva.Shape | Konva.Image | Konva.Text | Konva.Arrow | null) => void
}

const BOX_TYPES: Annotation['type'][] = ['highlight', 'rect', 'sticky', 'stamp', 'signature', 'text']

function AnnShape({ ann, width, height, draggable, selected, onDragEnd, onSelect, nodeRef }: AnnShapeProps) {
  const sw = strokeWidthPx(ann.strokeWidth, height)
  const color = ann.color

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const nx = Math.min(1, Math.max(0, e.target.x() / width))
    const ny = Math.min(1, Math.max(0, e.target.y() / height))
    onDragEnd?.({ ...ann, box: { ...ann.box, x: nx, y: ny } })
  }

  /** Para tipos con pivote en centro, el drag entrega el centro; convertimos a top-left */
  const handleCenteredDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const cx = Math.min(1, Math.max(0, e.target.x() / width))
    const cy = Math.min(1, Math.max(0, e.target.y() / height))
    const newBox = {
      x: cx - ann.box.width / 2,
      y: cy - ann.box.height / 2,
      width: ann.box.width,
      height: ann.box.height,
    }
    onDragEnd?.({ ...ann, box: newBox })
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

  const boxProps = BOX_TYPES.includes(ann.type)
    ? {
        ...commonProps,
        rotation: ann.rotation ?? 0,
        offsetX: (ann.box.width * width) / 2,
        offsetY: (ann.box.height * height) / 2,
        x: ann.box.x * width + (ann.box.width * width) / 2,
        y: ann.box.y * height + (ann.box.height * height) / 2,
        onDragEnd: draggable ? handleCenteredDragEnd : undefined,
        ref: (n: Konva.Shape | null) => nodeRef?.(n),
      }
    : commonProps

  switch (ann.type) {
    case 'highlight':
      return (
        <Rect
          width={ann.box.width * width}
          height={ann.box.height * height}
          fill={color}
          opacity={ann.opacity ?? 0.5}
          {...boxProps}
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
          {...boxProps}
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
          {...boxProps}
        />
      )
    case 'text':
      return (
        <Text
          width={ann.box.width * width}
          height={ann.box.height * height}
          text={ann.text ?? ''}
          fill={color}
          fontFamily="Arial"
          fontSize={16}
          wrap="word"
          align="left"
          {...boxProps}
        />
      )
    case 'stamp':
    case 'signature': {
      const subProps = {
        width: ann.box.width * width,
        height: ann.box.height * height,
        ...boxProps,
      }
      if (!ann.stampImage) {
        return <Rect stroke="#94a3b8" strokeWidth={1} dash={[4, 4]} {...subProps} />
      }
      return (
        <StampedImage
          ann={ann}
          width={width}
          height={height}
          draggable={draggable}
          onDragEnd={onDragEnd}
          nodeRef={nodeRef}
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
  nodeRef,
}: {
  ann: Annotation
  width: number
  height: number
  draggable: boolean
  onDragEnd?: (ann: Annotation) => void
  nodeRef?: (node: Konva.Image | null) => void
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
      ref={(n) => nodeRef?.(n)}
      x={ann.box.x * width + (ann.box.width * width) / 2}
      y={ann.box.y * height + (ann.box.height * height) / 2}
      width={ann.box.width * width}
      height={ann.box.height * height}
      rotation={ann.rotation ?? 0}
      offsetX={(ann.box.width * width) / 2}
      offsetY={(ann.box.height * height) / 2}
      draggable={draggable}
      onDragEnd={
        draggable
          ? (e) => {
              const cx = Math.min(1, Math.max(0, e.target.x() / width))
              const cy = Math.min(1, Math.max(0, e.target.y() / height))
              onDragEnd?.({
                ...ann,
                box: {
                  x: cx - ann.box.width / 2,
                  y: cy - ann.box.height / 2,
                  width: ann.box.width,
                  height: ann.box.height,
                },
              })
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
  const trRef = useRef<Konva.Transformer | null>(null)
  const selectedNodeRef = useRef<Konva.Shape | Konva.Image | Konva.Text | Konva.Arrow | null>(null)
  const selection = useEditorStore((s) => s.selection)
  const setSelection = useEditorStore((s) => s.setSelection)
  const selectedId =
    selection?.type === 'annotation' && selection.pageIndex === pageIndex ? selection.id ?? null : null

  const pageAnnotations = annotations.filter(
    (a) => a.pageIndex === pageIndex && !a.hidden,
  )
  const selectedAnn = selection?.type === 'annotation'
    ? pageAnnotations.find((a) => a.id === selection.id) ?? null
    : null
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
    if (tool === 'newtext') {
      setDraft({
        id: `ann-${Date.now()}`,
        pageIndex,
        type: 'text',
        color: strokeProps.color,
        strokeWidth: 0,
        opacity: 1,
        text: 'Texto nuevo',
        box: { x: p.x / width, y: p.y / height, width: 0.25, height: 0.06 },
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
    const text = draft.type === 'text'
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
    if (sticky || text) setEditing({ ann: newAnn, text: newAnn.text ?? '' })
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
  const editingText = editing?.ann.type === 'text'
  const editingAny = editingSticky || editingText

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    if (!selectedId) {
      tr.nodes([])
      selectedNodeRef.current = null
      return
    }
    const node = selectedNodeRef.current
    if (node) tr.nodes([node])
  }, [selectedId, pageAnnotations])

  const handleTransformEnd = () => {
    const node = selectedNodeRef.current
    const ann = pageAnnotations.find((a) => a.id === selectedId)
    if (!node || !ann) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const cx = node.x()
    const cy = node.y()
    const rotation = node.rotation()
    const newWidthPx = Math.max(4, (node.width() || 0) * scaleX)
    const newHeightPx = Math.max(4, (node.height() || 0) * scaleY)
    node.scaleX(1)
    node.scaleY(1)
    const newBox = {
      x: Math.min(1, Math.max(0, cx / width - newWidthPx / width / 2)),
      y: Math.min(1, Math.max(0, cy / height - newHeightPx / height / 2)),
      width: newWidthPx / width,
      height: newHeightPx / height,
    }
    updateAnnotation({ ...ann, box: newBox, rotation })
  }

  return (
    <div className="absolute inset-0 z-10">
      <Stage
        className="absolute left-0 top-0 z-10"
        width={width}
        height={height}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        style={{ pointerEvents: interactive && !editingAny ? 'auto' : 'none', touchAction: 'none' }}
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
              nodeRef={
                selectedId === ann.id
                  ? (n) => {
                      selectedNodeRef.current = n
                    }
                  : undefined
              }
              onDragEnd={(a) => updateAnnotation(a)}
              onSelect={handleClick}
            />
          ))}
          {draft && <AnnShape ann={draft} width={width} height={height} draggable={false} />}
          {isSelect && selectedId && BOX_TYPES.includes(selectedAnn?.type ?? 'rect') && (
            <Transformer
              ref={trRef}
              rotateEnabled
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox)}
              onTransformEnd={handleTransformEnd}
            />
          )}
        </Layer>
      </Stage>

      {editingAny && editing && (
        <textarea
          autoFocus
          value={editing.text}
          onChange={(e) => setEditing({ ann: editing.ann, text: e.target.value })}
          onBlur={() => {
            updateAnnotation({
              ...editing.ann,
              text: editing.text,
              box: {
                ...editing.ann.box,
                width: editingText ? 0.25 : editing.ann.box.width,
                height: editingText ? 0.06 : editing.ann.box.height,
              },
            })
            setEditing(null)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') setEditing(null)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute z-20 resize-none overflow-hidden rounded-sm px-1.5 py-1 font-sans text-sm leading-snug shadow outline-none ring-2 ring-blue-500 ${
            editingSticky ? 'bg-[#fef9c3] text-neutral-800' : 'bg-white/90 text-neutral-900'
          }`}
          style={{
            left: editing.ann.box.x * width,
            top: editing.ann.box.y * height,
            width: editing.ann.box.width * width,
            height: editing.ann.box.height * height,
            color: editingText ? editing.ann.color : undefined,
          }}
        />
      )}
    </div>
  )
}

export default AnnotationLayer