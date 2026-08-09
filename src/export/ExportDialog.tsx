import { useState } from 'react'
import { X, CloudDownload } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { buildEditedPdf, type ExportOptions } from './buildPdf'
import type { PdfEngine } from '@/core/PdfEngine'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  engine: PdfEngine
}

/**
 * Diálogo de exportación (Fase 6.3): permite elegir escala, compresión
 * estructural y qué incluir (anotaciones / ediciones de texto) antes de
 * descargar el PDF.
 */
export function ExportDialog({ open, onClose, engine }: ExportDialogProps) {
  const pdfDoc = useEditorStore((s) => s.document)
  const [scalePct, setScalePct] = useState(100)
  const [includeAnnotations, setIncludeAnnotations] = useState(true)
  const [includeEdits, setIncludeEdits] = useState(true)
  const [compressed, setCompressed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleExport = async () => {
    if (!pdfDoc || !engine.bytes) return
    setBusy(true)
    setError(null)
    try {
      const options: ExportOptions = {
        scale: scalePct / 100,
        includeAnnotations,
        includeEdits,
        compressed,
      }
      const bytes = await buildEditedPdf(engine.bytes, pdfDoc.pages, pdfDoc, options)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = pdfDoc.name.replace(/\.pdf$/i, '') + '-editado.pdf'
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al exportar')
    } finally {
      setBusy(false)
    }
  }

  const Toggle = ({
    label,
    checked,
    onChange,
  }: {
    label: string
    checked: boolean
    onChange: (v: boolean) => void
  }) => (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm"
    >
      <span className="text-neutral-700">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-neutral-300'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-800">Exportar PDF</h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-neutral-700">Escala</span>
            <span className="text-xs text-neutral-500">{scalePct}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={scalePct}
            onChange={(e) => setScalePct(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-neutral-400">
            <span>50%</span>
            <span>100%</span>
            <span>200%</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Toggle
            label="Incluir anotaciones"
            checked={includeAnnotations}
            onChange={setIncludeAnnotations}
          />
          <Toggle label="Aplicar ediciones de texto" checked={includeEdits} onChange={setIncludeEdits} />
          <Toggle label="Compresión de objetos" checked={compressed} onChange={setCompressed} />
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
            <CloudDownload size={14} />
            {busy ? 'Exportando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </div>
  )
}