import { useEffect, useRef, useState } from 'react'
import { X, Eraser, Check } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

interface SignatureModalProps {
  open: boolean
  onClose: () => void
}

export function SignatureModal({ open, onClose }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [signature, setSignature] = useState<string | null>(null)

  const addAnnotation = useEditorStore((s) => s.addAnnotation)
  const setTool = useEditorStore((s) => s.setTool)

  useEffect(() => {
    if (!open) return
    setSignature(null)
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = 2
    canvas.width = 400 * dpr
    canvas.height = 160 * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, 400, 160)
  }, [open])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    const { x, y } = getPos(e)
    ctx?.beginPath()
    ctx?.moveTo(x, y)
    ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas) setSignature(canvas.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, 400, 160)
    canvasRef.current?.setPointerCapture(0) // noop-safe
    setSignature(null)
  }

  const confirm = () => {
    if (!signature) return
    const pageIndex = useEditorStore.getState().activePageIndex
    addAnnotation({
      id: `sig-${Date.now()}`,
      pageIndex,
      type: 'signature',
      box: { x: 0.55, y: 0.75, width: 0.28, height: 0.1 },
      color: '#1e293b',
      strokeWidth: 0.002,
      opacity: 1,
      stampImage: signature,
    })
    setTool('select')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-800">Firma digital</h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="relative mb-4 overflow-hidden rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50">
          <canvas
            ref={canvasRef}
            className="h-40 w-full rounded-lg"
            style={{ touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
          />
          {!signature && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
              Dibuja tu firma aquí
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={clear}
            disabled={!signature}
            className="flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Eraser size={14} /> Limpiar
          </button>
          <button
            onClick={confirm}
            disabled={!signature}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Check size={14} /> Colocar en la página
          </button>
        </div>
      </div>
    </div>
  )
}