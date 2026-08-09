import { useState } from 'react'
import { CloudDownload } from 'lucide-react'
import { ExportDialog } from './ExportDialog'
import type { PdfEngine } from '@/core/PdfEngine'

interface ExportButtonProps {
  engine: PdfEngine
}

export function ExportButton({ engine }: ExportButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <CloudDownload size={14} />
        Exportar
      </button>
      <ExportDialog open={open} onClose={() => setOpen(false)} engine={engine} />
    </>
  )
}