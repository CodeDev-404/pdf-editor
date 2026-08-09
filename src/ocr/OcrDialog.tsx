import { useState } from 'react'
import { X, ScanText } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { ocrPage } from '@/ocr/ocr'
import type { PdfEngine } from '@/core/PdfEngine'

interface OcrDialogProps {
  open: boolean
  onClose: () => void
  engine: PdfEngine
}

/**
 * OCR (Fase 9.2): detecta texto en la página activa (ideal para PDFs
 * escaneados) usando Tesseract.js y lo carga en el store para que funcione
 * la edición de texto y la búsqueda.
 */
export function OcrDialog({ open, onClose, engine }: OcrDialogProps) {
  const document = useEditorStore((s) => s.document)
  const activePageIndex = useEditorStore((s) => s.activePageIndex)
  const setTextItems = useEditorStore((s) => s.setTextItems)
  const setTool = useEditorStore((s) => s.setTool)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const page = document?.pages[activePageIndex]

  const handleRun = async () => {
    if (!document || !page) return
    if (page.blank) {
      setError('La página en blanco no tiene contenido que reconocer')
      return
    }
    setBusy(true)
    setError(null)
    setProgress(0)
    setCount(null)
    try {
      const items = await ocrPage(engine, page, {
        lang: 'spa+eng',
        scale: 2,
        onProgress: (p) => setProgress(p),
      })
      setTextItems(activePageIndex, items)
      setCount(items.length)
      // pasa al modo edición de texto para ver las cajas reconocidas
      setTool('text')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al ejecutar el OCR')
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
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-800">
            <ScanText size={16} className="text-neutral-500" />
            OCR en página {activePageIndex + 1}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-xs text-neutral-500">
          Detecta el texto de la página (ideal si es un escaneado) y lo deja
          listo para editar y buscar. Usa Tesseract.js (idioma español + inglés).
        </p>

        {busy && (
          <div className="mb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-neutral-400">
              {Math.round(progress * 100)}% reconociendo…
            </p>
          </div>
        )}

        {count !== null && !busy && (
          <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Se reconocieron {count} bloques de texto. Cambia a modo edición para
            ajustarlos.
          </p>
        )}

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            Cerrar
          </button>
          <button
            onClick={() => void handleRun()}
            disabled={busy}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <ScanText size={14} />
            {busy ? 'Reconociendo…' : 'Reconocer texto'}
          </button>
        </div>
      </div>
    </div>
  )
}