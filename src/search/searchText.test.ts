import { describe, expect, it } from 'vitest'
import { searchTextItems, matchPage } from './searchText'
import type { TextItem } from '@/types'

function item(id: string, str: string, pageIndex: number): TextItem {
  return {
    id,
    pageIndex,
    str,
    box: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    fontSizePx: 12,
    fontFamily: 'Helvetica',
    color: '#000',
    hasEOL: false,
  }
}

describe('searchText', () => {
  it('encuentra coincidencias insensibles a mayúsculas', () => {
    const byPage: Record<number, TextItem[]> = {
      0: [item('a', 'Hola mundo', 0), item('b', 'Otro texto', 0)],
    }
    const matches = searchTextItems('mundo', byPage)
    expect(matches).toHaveLength(1)
    expect(matches[0].pageIndex).toBe(0)
  })

  it('omite queries vacíos', () => {
    expect(searchTextItems('', {})).toHaveLength(0)
  })

  it('devuelve la página de la coincidencia activa', () => {
    const byPage: Record<number, TextItem[]> = {
      0: [item('a', 'alpha', 0)],
      2: [item('b', 'beta', 2)],
    }
    const matches = searchTextItems('a', byPage)
    expect(matchPage(matches, 0)).toBe(0)
  })
})