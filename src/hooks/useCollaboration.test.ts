import { describe, expect, it } from 'vitest'
import { useEditorStore } from '@/store/editorStore'
import type { PdfDocumentState } from '@/types'

function makeDoc(name: string, updatedAt: number): PdfDocumentState {
  return {
    name,
    pageCount: 1,
    pages: [{ index: 0, width: 600, height: 800, rotation: 0 }],
    edits: {},
    annotations: [],
    updatedAt,
  }
}

describe('colaboración LWW en el store', () => {
  it('patchDocument aplica un documento remoto preservando navegación', () => {
    useEditorStore.getState().setDocument(makeDoc('a.pdf', 1))
    useEditorStore.setState({ activePageIndex: 3, zoom: 1.5 })

    useEditorStore.getState().patchDocument({
      ...makeDoc('a.pdf', 99),
      annotations: [{ id: 'remote-ann', pageIndex: 0, type: 'rect', color: '#f00', box: { x: 0, y: 0, width: 0.1, height: 0.1 } }],
    })

    const state = useEditorStore.getState()
    expect(state.document?.annotations.length).toBe(1)
    // la navegación local se preserva
    expect(state.activePageIndex).toBe(3)
    expect(state.zoom).toBe(1.5)
  })

  it('setDocument (carga inicial) sí resetea navegación', () => {
    useEditorStore.getState().setDocument(makeDoc('a.pdf', 1))
    expect(useEditorStore.getState().activePageIndex).toBe(0)
  })

  it('las acciones de edición marcan updatedAt', () => {
    useEditorStore.getState().setDocument({ ...makeDoc('a.pdf', 1) })
    const before = useEditorStore.getState().document?.updatedAt ?? 0
    useEditorStore.getState().addAnnotation({
      id: 'x',
      pageIndex: 0,
      type: 'highlight',
      color: '#fde047',
      box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    })
    const after = useEditorStore.getState().document?.updatedAt ?? 0
    expect(after).toBeGreaterThanOrEqual(before)
  })
})