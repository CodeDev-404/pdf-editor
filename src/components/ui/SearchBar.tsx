import { useEffect, useRef, useState } from 'react'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { searchTextItems } from '@/search/searchText'

/**
 * Buscador de texto (Fase 9.1): encuentra coincidencias en el contenido
 * extraído por pdf.js y permite navegar entre resultados.
 */
export function SearchBar() {
  const [localQuery, setLocalQuery] = useState('')
  const search = useEditorStore((s) => s.search)
  const textItems = useEditorStore((s) => s.textItems)
  const setSearch = useEditorStore((s) => s.setSearch)
  const setActiveMatch = useEditorStore((s) => s.setActiveMatch)
  const closeSearch = useEditorStore((s) => s.closeSearch)
  const setActivePage = useEditorStore((s) => s.setActivePage)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const runSearch = (query: string) => {
    setLocalQuery(query)
    setSearch(query, searchTextItems(query, textItems))
  }

  const navigate = (dir: 1 | -1) => {
    const next = search.activeMatch + dir
    setActiveMatch(next)
    const match = search.matches[search.activeMatch + dir]
    if (match) {
      setActivePage(match.pageIndex)
      // un pequeño retardo para que konva/el viewport terminen de renderizar
      window.setTimeout(() => {
        document.querySelector(`[data-search-row-${match.pageIndex}]`)?.scrollIntoView({ block: 'center' })
      }, 30)
    }
  }

  return (
    <div className="relative">
      <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        ref={inputRef}
        value={localQuery}
        onChange={(e) => runSearch(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') navigate(e.shiftKey ? -1 : 1)
          if (e.key === 'Escape') closeSearch()
        }}
        placeholder="Buscar texto…"
        className="w-44 rounded-md border border-neutral-300 py-1 pl-7 pr-7 text-xs outline-none focus:border-blue-500"
      />
      {localQuery.length > 0 && (
        <>
          <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">
            {search.activeMatch >= 0 ? `${search.activeMatch + 1}/${search.matches.length}` : '0'}
          </span>
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2">
            <button
              onClick={() => navigate(1)}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100"
              title="Siguiente (Enter)"
            >
              <ChevronDown size={13} />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100"
              title="Anterior (Shift+Enter)"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={closeSearch}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100"
              title="Cerrar (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}