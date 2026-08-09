import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import type { PdfDocumentState } from '@/types'

interface HistoryEntry {
  kind: 'past' | 'future' | 'current'
  /** profundidad para undo/redo: posicion en el array de pastStates/futureStates */
  steps: number
  pages: number
  annotations: number
  edits: number
  label: string
}

function snapshotLabel(doc?: PdfDocumentState | null, index?: number): string {
  if (!doc) return index !== undefined ? `Inicio (estado ${index + 1})` : 'Inicio'
  const parts: string[] = []
  if (doc.pageCount > 0) parts.push(`${doc.pageCount} págs.`)
  if (doc.annotations.length > 0) parts.push(`${doc.annotations.length} anot.`)
  const editCount = Object.values(doc.edits ?? {}).reduce((n, l) => n + l.length, 0)
  if (editCount > 0) parts.push(`${editCount} edic.`)
  return parts.join(' · ') || 'Documento'
}

function buildEntries(
  past: PdfDocumentState[],
  future: PdfDocumentState[],
  current: PdfDocumentState | null,
): HistoryEntry[] {
  const entries: HistoryEntry[] = []

  // Estados "futuros" (se restauran con redo). future[0] es el más cercano al
  // presente; los mostramos en orden ascendente (el más lejano arriba).
  for (let i = 0; i < future.length; i++) {
    const doc = future[i]
    entries.push({
      kind: 'future',
      steps: i,
      pages: doc?.pageCount ?? 0,
      annotations: doc?.annotations.length ?? 0,
      edits: 0,
      label: snapshotLabel(doc, -1),
    })
  }

  // Estado actual (arriba).
  entries.push({
    kind: 'current',
    steps: 0,
    pages: current?.pageCount ?? 0,
    annotations: current?.annotations.length ?? 0,
    edits: 0,
    label: 'Actual',
  })

  // Estados pasados (se restauran con undo). past[0] es el más antiguo, el
  // último es el inmediatamente anterior al actual. Los mostramos del más
  // reciente al más antiguo.
  for (let i = past.length - 1; i >= 0; i--) {
    const doc = past[i]
    entries.push({
      kind: 'past',
      steps: i,
      pages: doc?.pageCount ?? 0,
      annotations: doc?.annotations.length ?? 0,
      edits: 0,
      label: snapshotLabel(doc, i),
    })
  }

  return entries
}

/**
 * Historial visual de cambios (Fase 9.3): muestra una línea de tiempo de
 * estados (pasados/futuros) recuperados vía zundo y permite saltar a
 * cualquiera con un clic.
 */
export function HistoryPanel() {
  const [open, setOpen] = useState(false)
  const document = useEditorStore((s) => s.document)

  const [past, setPast] = useState<PdfDocumentState[]>([])
  const [future, setFuture] = useState<PdfDocumentState[]>([])

  useEffect(() => {
    const temporal = useEditorStore.temporal
    const update = () => {
      const s = temporal.getState()
      setPast(s.pastStates as unknown as PdfDocumentState[])
      setFuture(s.futureStates as unknown as PdfDocumentState[])
    }
    update()
    return temporal.subscribe(update)
  }, [])

  const entries = buildEntries(past, future, document)

  const jumpTo = (kind: 'past' | 'future', index: number) => {
    const temporal = useEditorStore.temporal
    if (kind === 'past') {
      // past[index] está a `past.length - index` pasos de undo desde el presente
      temporal.getState().undo(past.length - index)
    } else {
      // future[index] está a `future.length - index` pasos de redo
      temporal.getState().redo(future.length - index)
    }
  }

  return (
    <aside className="flex w-56 flex-col border-l border-neutral-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <History size={13} className="text-neutral-400" />
        Historial
        <span className="ml-auto text-[10px] font-normal text-neutral-400">
          {past.length + future.length}
        </span>
      </button>
      {open && (
        <div className="flex h-40 flex-col overflow-y-auto p-1">
          {entries.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] text-neutral-400">Sin cambios aún.</p>
          ) : (
            entries.map((entry, idx) => (
              <button
                key={idx}
                onClick={() => entry.kind !== 'current' && jumpTo(entry.kind, entry.steps)}
                disabled={entry.kind === 'current'}
                className={`flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition ${
                  entry.kind === 'current'
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    entry.kind === 'current'
                      ? 'bg-blue-500'
                      : entry.kind === 'future'
                        ? 'bg-emerald-400'
                        : 'bg-neutral-300'
                  }`}
                />
                <span className="truncate">{entry.label}</span>
                <span className="ml-auto text-[10px] text-neutral-400">
                  {entry.pages}p · {entry.annotations}a
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </aside>
  )
}