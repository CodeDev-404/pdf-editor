import {
  MousePointer,
  Type,
  Highlighter,
  Square,
  Minus,
  MoveUpRight,
  Pen,
  StickyNote,
  Stamp,
  Signature,
  Undo2,
  Redo2,
} from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { ZoomControls } from '@/viewer/ZoomControls'
import type { Tool } from '@/types'

const TOOLS = [
  { id: 'select', label: 'Seleccionar', icon: MousePointer },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'highlight', label: 'Resaltar', icon: Highlighter },
  { id: 'rectangle', label: 'Rectángulo', icon: Square },
  { id: 'line', label: 'Línea', icon: Minus },
  { id: 'arrow', label: 'Flecha', icon: MoveUpRight },
  { id: 'ink', label: 'Dibujo libre', icon: Pen },
  { id: 'sticky', label: 'Nota', icon: StickyNote },
  { id: 'stamp', label: 'Sello', icon: Stamp },
  { id: 'signature', label: 'Firma', icon: Signature },
] satisfies readonly { id: Tool; label: string; icon: typeof MousePointer }[]

export function Toolbar({
  onUndo,
  onRedo,
  onToolSelect,
}: {
  onUndo?: () => void
  onRedo?: () => void
  onToolSelect?: (tool: Tool) => void
}) {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)

  const selectTool = (t: Tool) => {
    setTool(t)
    onToolSelect?.(t)
  }

  return (
    <header className="flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-1.5">
      <h1 className="mr-3 text-sm font-semibold text-neutral-700">PDF Editor</h1>
      <div className="flex items-center gap-0.5 rounded-lg border border-neutral-200 p-0.5">
        {TOOLS.map((t) => {
          const Icon = t.icon
          const active = tool === t.id
          return (
            <button
              key={t.id}
              title={t.label}
              onClick={() => selectTool(t.id)}
              className={`rounded p-1.5 transition ${
                active ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <Icon size={16} />
            </button>
          )
        })}
      </div>
      <div className="mx-1 h-5 w-px bg-neutral-300" />
      <button
        className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
        onClick={onUndo}
        title="Deshacer (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-30"
        onClick={onRedo}
        title="Rehacer (Ctrl+Y)"
      >
        <Redo2 size={16} />
      </button>
      <div className="ml-auto">
        <ZoomControls />
      </div>
    </header>
  )
}