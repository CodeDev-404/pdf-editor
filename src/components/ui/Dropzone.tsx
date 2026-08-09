import { useCallback, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { isPdfFile } from '@/services/fileValidation'

interface DropzoneProps {
  onFile: (file: File) => void
}

export function Dropzone({ onFile }: DropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      if (!(await isPdfFile(file))) {
        setError('Solo se admiten archivos PDF')
        return
      }
      setError(null)
      onFile(file)
    },
    [onFile],
  )

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className={`flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 bg-white'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <UploadCloud size={48} className="text-neutral-400" />
        <div>
          <p className="text-sm font-medium text-neutral-700">
            Arrastra un PDF aquí o selecciona un archivo
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Procesamiento 100% local: el documento nunca sale de tu navegador.
          </p>
        </div>
        <label className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Elegir archivo
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                if (!(await isPdfFile(file))) {
                  setError('Solo se admiten archivos PDF')
                  return
                }
                setError(null)
                onFile(file)
              }
              e.target.value = ''
            }}
          />
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}