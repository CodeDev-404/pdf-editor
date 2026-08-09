import type { SearchMatch, TextItem } from '@/types'

/** Busca el query en los items de texto de cada página (insensible a mayúsculas). */
export function searchTextItems(
  query: string,
  textItemsByPage: Record<number, TextItem[]>,
): SearchMatch[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const matches: SearchMatch[] = []
  for (const [pageStr, items] of Object.entries(textItemsByPage)) {
    const pageIndex = Number(pageStr)
    for (const item of items) {
      if (item.str.toLowerCase().includes(q)) {
        matches.push({
          id: `match-${pageIndex}-${item.id}`,
          pageIndex,
          box: { ...item.box },
        })
      }
    }
  }
  return matches
}

/** Devuelve la página de la coincidencia activa (para navegar a ella). */
export function matchPage(matches: SearchMatch[], activeMatch: number): number | null {
  const m = matches[activeMatch]
  return m ? m.pageIndex : null
}