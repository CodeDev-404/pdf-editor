import { useEditorStore } from '@/store/editorStore'
import type { Annotation, Tool } from '@/types'

const PROP_TOOLS: Tool[] = ['highlight', 'rectangle', 'line', 'arrow', 'ink', 'newtext']

const PRESETS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#000000']

/**
 * Barra de propiedades contextual (Fase 6.1).
 * - Con herramienta de dibujo activa: edita color/grosor/opacidad de los
 *   próximos trazos (stock en store.strokeProps, aplicado al crear el draft).
 * - Con anotación seleccionada: aplica los cambios directamente a la anotación.
 */
export function PropsBar() {
  const tool = useEditorStore((s) => s.tool)
  const selection = useEditorStore((s) => s.selection)
  const annotations = useEditorStore((s) => s.document?.annotations ?? [])
  const strokeProps = useEditorStore((s) => s.strokeProps)
  const setStrokeProps = useEditorStore((s) => s.setStrokeProps)
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation)

  const selectedAnn = selection?.type === 'annotation'
    ? annotations.find((a) => a.id === selection.id) ?? null
    : null

  if (!PROP_TOOLS.includes(tool) && !selectedAnn) return null

  const color = selectedAnn?.color ?? strokeProps.color
  const strokeWidth = selectedAnn?.strokeWidth ?? strokeProps.strokeWidth
  const opacity = selectedAnn?.opacity ?? strokeProps.opacity

  const apply = (patch: Partial<Pick<Annotation, 'color' | 'strokeWidth' | 'opacity'>>) => {
    if (selectedAnn) {
      updateAnnotation({ ...selectedAnn, ...patch })
    } else {
      setStrokeProps(patch)
    }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs shadow-sm"
      data-props-bar
    >
      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Color</span>
        <div className="flex items-center gap-1">
          {PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => apply({ color: c })}
              className="h-4 w-4 rounded-full border border-neutral-200 transition hover:scale-110"
              style={{ background: c }}
              title={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => apply({ color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border border-neutral-300 bg-transparent p-0"
          />
        </div>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Grosor</span>
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={Math.round((strokeWidth ?? 0.0025) * 4000) / 1000}
          onChange={(e) => apply({ strokeWidth: Number(e.target.value) / 4000 })}
          className="w-24 accent-blue-600"
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-neutral-500">Opacidad</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity ?? 1}
          onChange={(e) => apply({ opacity: Number(e.target.value) })}
          className="w-24 accent-blue-600"
        />
      </label>
      {selectedAnn && (
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
          Anotación seleccionada
        </span>
      )}
    </div>
  )
}