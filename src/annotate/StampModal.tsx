import { useEffect, useRef, useState } from 'react'
import { X, Check } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

interface StampModalProps {
  open: boolean
  onClose: () => void
}

interface StampDef {
  id: string
  label: string
  text: string
  color: string
}

const STAMPS: StampDef[] = [
  { id: 'approved', label: 'APROBADO', text: 'APROBADO', color: '#16a34a' },
  { id: 'received', label: 'RECIBIDO', text: 'RECIBIDO', color: '#2563eb' },
  { id: 'confidential', label: 'CONFIDENCIAL', text: 'CONFIDENCIAL', color: '#dc2626' },
  { id: 'urgent', label: 'URGENTE', text: 'URGENTE', color: '#dc2626' },
  { id: 'copy', label: 'COPIA', text: 'COPIA', color: '#7c3aed' },
  { id: 'draft', label: 'BORRADOR', text: 'BORRADOR', color: '#ea580c' },
  { id: 'void', label: 'ANULADO', text: 'ANULADO', color: '#64748b' },
  { id: 'signed', label: 'FIRMADO', text: 'FIRMADO', color: '#2563eb' },
] as const

/**
 * Modal de sellos (Fase 5): elige un sello predefinido (APROBADO, RECIBIDO,
 * CONFIDENCIAL, ...) que se renderiza a un PNG con borde/círculo elíptico y
 * se coloca como anotación 'stamp' en la página activa.
 */
export function StampModal({ open, onClose }: StampModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [picked, setPicked] = useState<StampDef | null>(null)

  const addAnnotation = useEditorStore((s) => s.addAnnotation)
  const setTool = useEditorStore((s) => s.setTool)

  useEffect(() => {
    if (!open) return
    setPicked(null)
  }, [open])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && picked) renderStamp(canvas, picked.text, picked.color)
  }, [picked])

  const confirm = () => {
    if (!picked) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const pageIndex = useEditorStore.getState().activePageIndex
    addAnnotation({
      id: `stamp-${Date.now()}`,
      pageIndex,
      type: 'stamp',
      box: { x: 0.35, y: 0.35, width: 0.3, height: 0.18 },
      color: picked.color,
      opacity: 0.85,
      stampImage: dataUrl,
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
          <h2 className="text-base font-semibold text-neutral-800">Sellos</h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {STAMPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setPicked(s)}
              className={`rounded-lg border p-2 text-center transition ${
                picked === s ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
              }`}
            >
              <span
                className="mx-auto block w-full rounded-sm border-2 py-1 text-[10px] font-bold tracking-wider"
                style={{ color: s.color, borderColor: s.color, borderRadius: '30% / 50%' }}
              >
                {s.text}
              </span>
              <span className="mt-1 block text-[10px] text-neutral-500">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="relative my-4 overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
          <canvas
            ref={canvasRef}
            className="h-24 w-full rounded-lg"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Check size={14} /> Colocar en la página
          </button>
        </div>
      </div>
    </div>
  )
}

function renderStamp(canvas: HTMLCanvasElement, text: string, color: string) {
  const dpr = 2
  const w = 320
  const h = 180
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(w / 2, h / 2, w / 2 - 8, h / 2 - 8, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = '700 34px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.transform(1, -0.12, 0, 1, 0, h * 0.06)
  ctx.fillText(text, w / 2, h / 2)
  ctx.restore()

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(w / 2, h / 2, w / 2 - 18, h / 2 - 18, 0, 0, Math.PI * 2)
  ctx.stroke()
}