import { useState } from 'react'
import { Layers, Eye, EyeOff, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import type { Annotation } from '@/types'

const TYPE_LABELS: Record<Annotation['type'], string> = {
  highlight: 'Resaltado',
  rect: 'Rectángulo',
  line: 'Línea',
  arrow: 'Flecha',
  ink: 'Dibujo',
  sticky: 'Nota',
  stamp: 'Sello',
  signature: 'Firma',
  text: 'Texto',
}

/**
 * Panel de capas (Fase 8.2): lista las anotaciones de la página activa y
 * permite ocultar/mostrar, borrar y subir/bajar su orden de apilado.
 */
export function LayersPanel() {
  const [open, setOpen] = useState(true)
  const document = useEditorStore((s) => s.document)
  const activePageIndex = useEditorStore((s) => s.activePageIndex)
  const selection = useEditorStore((s) => s.selection)
  const setSelection = useEditorStore((s) => s.setSelection)
  const setAnnotationHidden = useEditorStore((s) => s.setAnnotationHidden)
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation)
  const moveAnnotation = useEditorStore((s) => s.moveAnnotation)

  if (!document) return null

  const pageAnnotations = document.annotations.filter((a) => a.pageIndex === activePageIndex)
  const allHidden = pageAnnotations.length > 0 && pageAnnotations.every((a) => a.hidden)
  const selectedId = selection?.type === 'annotation' ? selection.id : null

  return (
    <aside className="flex w-56 flex-col border-l border-neutral-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <Layers size={13} className="text-neutral-400" />
        Capas
        <span className="ml-auto text-[10px] font-normal text-neutral-400">
          {pageAnnotations.length}
        </span>
        <ChevronDown size={13} className={`transition ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">
              Página {activePageIndex + 1}
            </span>
            <button
              onClick={() => {
                for (const a of pageAnnotations) setAnnotationHidden(a.id, !allHidden)
              }}
              className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
            >
              {allHidden ? <Eye size={11} /> : <EyeOff size={11} />}
              {allHidden ? 'Mostrar todo' : 'Ocultar todo'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {pageAnnotations.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-neutral-400">
                Sin anotaciones en esta página.
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {pageAnnotations.map((ann, i) => (
                <li
                  key={ann.id}
                  className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition ${
                    selectedId === ann.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-transparent hover:bg-neutral-50'
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelection(
                        selectedId === ann.id
                          ? null
                          : { pageIndex: activePageIndex, type: 'annotation', id: ann.id },
                      )
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 text-left ${
                      ann.hidden ? 'text-neutral-400 line-through' : 'text-neutral-700'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: ann.color || '#94a3b8' }}
                    />
                    <span className="truncate">{TYPE_LABELS[ann.type] ?? ann.type}</span>
                  </button>
                  <button
                    onClick={() => setAnnotationHidden(ann.id, !ann.hidden)}
                    className="rounded p-0.5 text-neutral-400 hover:text-neutral-600"
                    title={ann.hidden ? 'Mostrar' : 'Ocultar'}
                  >
                    {ann.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    onClick={() => removeAnnotation(ann.id)}
                    className="rounded p-0.5 text-neutral-400 hover:text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => moveAnnotation(ann.id, -1)}
                    disabled={i === 0}
                    className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-30"
                    title="Subir capa"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => moveAnnotation(ann.id, 1)}
                    disabled={i === pageAnnotations.length - 1}
                    className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-30"
                    title="Bajar capa"
                  >
                    <ChevronDown size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </aside>
  )
}