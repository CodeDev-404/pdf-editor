import { useState } from 'react'
import { CloudDownload, Image as ImageIcon, FileText } from 'lucide-react'
import { ExportDialog } from './ExportDialog'
import { ImageExportDialog } from './ImageExportDialog'
import type { PdfEngine } from '@/core/PdfEngine'

interface ExportButtonProps {
  engine: PdfEngine
}

export function ExportButton({ engine }: ExportButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [imgOpen, setImgOpen] = useState(false)

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <CloudDownload size={14} />
          Exportar
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              onClick={() => {
                setMenuOpen(false)
                setPdfOpen(true)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50"
            >
              <FileText size={14} className="text-neutral-400" />
              PDF editado
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                setImgOpen(true)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50"
            >
              <ImageIcon size={14} className="text-neutral-400" />
              Página actual como imagen
            </button>
          </div>
        )}
      </div>

      <ExportDialog open={pdfOpen} onClose={() => setPdfOpen(false)} engine={engine} />
      <ImageExportDialog open={imgOpen} onClose={() => setImgOpen(false)} engine={engine} />
    </>
  )
}