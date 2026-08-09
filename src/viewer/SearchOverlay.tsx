import { useEditorStore } from '@/store/editorStore'

interface SearchOverlayProps {
  pageIndex: number
  width: number
  height: number
}

/**
 * Resalta las coincidencias de búsqueda sobre una página (Fase 9.1).
 */
export function SearchOverlay({ pageIndex, width, height }: SearchOverlayProps) {
  const search = useEditorStore((s) => s.search)
  const matches = search.matches.filter((m) => m.pageIndex === pageIndex)
  if (!search.active || matches.length === 0) return null

  const activeMatch = search.activeMatch

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" data-search-highlight>
      {matches.map((m) => {
        const globalIndex = search.matches.findIndex((x) => x.id === m.id)
        const isActive = globalIndex === activeMatch
        return (
          <div
            key={m.id}
            className="absolute"
            style={{
              left: m.box.x * width,
              top: m.box.y * height,
              width: m.box.width * width,
              height: m.box.height * height,
              background: isActive ? 'rgba(255,235,59,0.7)' : 'rgba(250,204,21,0.45)',
              boxShadow: isActive ? '0 0 0 2px #f59e0b' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}