import { useState } from 'react'
import { X, Image as ImageIcon } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { downloadPageImage } from './imageExport'
import type { PdfEngine } from '@/core/PdfEngine'

interface ImageExportDialogProps {
  open: boolean
  onClose: () => void
  engine: PdfEngine
}

/**
 * Exporta la página activa (PDF base + anotaciones visibles) como imagen PNG o JPEG.
 */
export function ImageExportDialog({ open, onClose, engine }: ImageExportDialogProps) {
  const pdfDoc = useEditorStore((s) => s.document)
  const activePageIndex = useEditorStore((s) => s.activePageIndex)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scale, setScale] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const page = pdfDoc?.pages[activePageIndex]

  const handleExport = async () => {
    if (!pdfDoc || !engine.bytes || !page) return
    setBusy(true)
    setError(null)
    try {
      await downloadPageImage(engine, page, pdfDoc.annotations, `${pdfDoc.name.replace(/\.pdf$/i, '')}-pagina-${activePageIndex + 1}`, {
        format,
        scale,
        quality: 0.92,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar la imagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-800">Exportar página como imagen</h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {page ? (
          <>
            <p className="mb-3 text-xs text-neutral-500">
              Página {activePageIndex + 1} · {page.width}×{page.height} pt
            </p>

            <div className="mb-3 flex gap-2">
              {(['png', 'jpeg'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    format === f
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-neutral-700">Resolución</span>
                <span className="text-xs text-neutral-500">
                  {scale === 1 ? '72 dpi' : scale === 2 ? '144 dpi' : '216 dpi'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>1×</span>
                <span>2×</span>
                <span>3×</span>
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleExport()}
                disabled={busy}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ImageIcon size={14} />
                {busy ? 'Generando…' : 'Descargar'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">No hay una página activa.</p>
        )}
      </div>
    </div>
  )
}