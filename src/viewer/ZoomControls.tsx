import { ZoomIn, ZoomOut, Maximize, AlignCenterHorizontal } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setZoomMode = useEditorStore((s) => s.setZoomMode)

  const pct = Math.round(zoom * 100)

  return (
    <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-1 py-0.5">
      <button
        className="rounded p-1.5 hover:bg-neutral-100"
        onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
        title="Alejar"
      >
        <ZoomOut size={16} />
      </button>
      <select
        className="w-16 rounded border border-transparent px-1 py-0.5 text-center text-xs hover:border-neutral-300"
        value={pct}
        onChange={(e) => setZoom(Number(e.target.value) / 100)}
      >
        {[50, 75, 100, 125, 150, 200].map((p) => (
          <option key={p} value={p}>
            {p}%
          </option>
        ))}
      </select>
      <button
        className="rounded p-1.5 hover:bg-neutral-100"
        onClick={() => setZoom(zoom + 0.25)}
        title="Acercar"
      >
        <ZoomIn size={16} />
      </button>
      <div className="mx-0.5 h-4 w-px bg-neutral-300" />
      <button
        className="rounded p-1.5 hover:bg-neutral-100"
        onClick={() => setZoomMode('fitWidth')}
        title="Ancho completo"
      >
        <AlignCenterHorizontal size={16} />
      </button>
      <button
        className="rounded p-1.5 hover:bg-neutral-100"
        onClick={() => setZoomMode('fitPage')}
        title="Página completa"
      >
        <Maximize size={16} />
      </button>
    </div>
  )
}