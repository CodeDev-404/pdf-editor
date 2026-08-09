import { useCallback, useEffect, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { PdfEngine } from '@/core/PdfEngine'
import { Dropzone } from '@/components/ui/Dropzone'
import { Toolbar } from '@/components/ui/Toolbar'
import { SearchBar } from '@/components/ui/SearchBar'
import { OcrDialog } from '@/ocr/OcrDialog'
import { PropsBar } from '@/components/ui/PropsBar'
import { LayersPanel } from '@/components/ui/LayersPanel'
import { HistoryPanel } from '@/components/ui/HistoryPanel'
import { Viewport } from '@/viewer/Viewport'
import { Thumbnails } from '@/viewer/Thumbnails'
import { ExportButton } from '@/export/ExportButton'
import { SignatureModal } from '@/annotate/SignatureModal'
import { StampModal } from '@/annotate/StampModal'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAutosave, clearAutosave } from '@/hooks/useAutosave'
import { loadDraft, draftToBytes } from '@/store/autosave'
import type { PageInfo, Tool } from '@/types'

export default function App() {
  const [engine, setEngine] = useState<PdfEngine | null>(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [stampOpen, setStampOpen] = useState(false)
  const [ocrOpen, setOcrOpen] = useState(false)
  const [draftOffer, setDraftOffer] = useState(false)
  const document = useEditorStore((s) => s.document)
  const activePageIndex = useEditorStore((s) => s.activePageIndex)
  const setActivePage = useEditorStore((s) => s.setActivePage)
  const putState = useEditorStore((s) => s.setDocument)
  const clearDocument = useEditorStore((s) => s.clearDocument)
  const reorderPages = useEditorStore((s) => s.reorderPages)
  const addBlankPage = useEditorStore((s) => s.addBlankPage)
  const deletePage = useEditorStore((s) => s.deletePage)

  useEffect(() => {
    setDraftOffer(loadDraft() !== null && !engine)
  }, [])
  useAutosave(engine)

  const handleUndo = () => {
    void useEditorStore.temporal.getState().undo()
  }
  const handleRedo = () => {
    void useEditorStore.temporal.getState().redo()
  }
  useKeyboardShortcuts(handleUndo, handleRedo)

  const handleFile = useCallback(
    async (file: File) => {
      const buf = await file.arrayBuffer()
      const eng = await PdfEngine.create(buf)
      const pageInfos: PageInfo[] = []
      for (let i = 0; i < eng.pageCount; i++) {
        pageInfos.push(await eng.getPageInfo(i))
      }
      setEngine(eng)
      putState({
        name: file.name,
        pageCount: eng.pageCount,
        pages: pageInfos,
        edits: {},
        annotations: [],
      })
    },
    [putState],
  )

  const handleClose = () => {
    clearAutosave()
    engine?.destroy()
    setEngine(null)
    clearDocument()
  }

  const handleRestore = useCallback(async () => {
    const draft = loadDraft()
    if (!draft) return
    const eng = await PdfEngine.create(draftToBytes(draft))
    setEngine(eng)
    putState(draft.doc)
    setDraftOffer(false)
  }, [putState])

  const handleToolSelect = (tool: Tool) => {
    if (tool === 'signature') setSignatureOpen(true)
    if (tool === 'stamp') setStampOpen(true)
  }

  if (!engine || !document) {
    return (
      <div className="relative flex h-full flex-col">
        {draftOffer && (
          <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
            <p className="text-sm font-medium text-amber-800">
              Tienes un borrador sin terminar guardado.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void handleRestore()}
                className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                Restaurar borrador
              </button>
              <button
                onClick={() => {
                  clearAutosave()
                  setDraftOffer(false)
                }}
                className="rounded-md border border-amber-300 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
              >
                Descartar
              </button>
            </div>
          </div>
        )}
        <Dropzone onFile={handleFile} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-1.5">
        <div className="truncate text-sm text-neutral-700">{document.name}</div>
        <div className="flex items-center gap-2">
          <SearchBar />
          <button
            onClick={() => setOcrOpen(true)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
            title="Reconocer texto en la página (OCR)"
          >
            OCR
          </button>
          <ExportButton engine={engine} />
          <button
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-emerald-50 hover:border-emerald-400"
            onClick={handleClose}
          >
            Abrir otro
          </button>
        </div>
      </div>
      <Toolbar onUndo={handleUndo} onRedo={handleRedo} onToolSelect={handleToolSelect} />
      {document && (
        <div className="flex items-center justify-center gap-2 px-3 py-1">
          <PropsBar />
        </div>
      )}
      <div className="flex h-full overflow-hidden">
        <Thumbnails
          engine={engine}
          pages={document.pages}
          activeIndex={activePageIndex}
          onSelect={setActivePage}
          onReorder={(order) => reorderPages(order)}
          onInsertAfter={(i) => addBlankPage(i)}
          onDelete={(i) => deletePage(i)}
        />
        <Viewport engine={engine} pages={document.pages} />
        <div className="flex flex-col">
          <LayersPanel />
          <HistoryPanel />
        </div>
      </div>
      <SignatureModal open={signatureOpen} onClose={() => setSignatureOpen(false)} />
      <StampModal open={stampOpen} onClose={() => setStampOpen(false)} />
      <OcrDialog open={ocrOpen} onClose={() => setOcrOpen(false)} engine={engine} />
    </div>
  )
}