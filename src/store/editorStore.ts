import { create } from 'zustand'
import { temporal } from 'zundo'
import type {
  Annotation,
  EditedText,
  PdfDocumentState,
  Tool,
  TextItem,
  ZoomMode,
} from '../types'

export interface EditorSelection {
  pageIndex: number
  type: 'page' | 'annotation'
  id?: string
}

export interface EditorStore {
  document: PdfDocumentState | null
  textItems: Record<number, TextItem[]>
  activePageIndex: number
  zoom: number
  zoomMode: ZoomMode
  tool: Tool
  selection: EditorSelection | null
  isBusy: boolean
  strokeProps: { color: string; strokeWidth: number; opacity: number }

  setDocument: (doc: PdfDocumentState) => void
  setTextItems: (pageIndex: number, items: TextItem[]) => void
  setActivePage: (index: number) => void
  setZoom: (zoom: number) => void
  setZoomMode: (mode: ZoomMode) => void
  setTool: (tool: Tool) => void
  setSelection: (sel: EditorSelection | null) => void
  setBusy: (busy: boolean) => void
  setStrokeProps: (props: Partial<{ color: string; strokeWidth: number; opacity: number }>) => void

  addEdit: (pageIndex: number, edit: EditedText) => void
  removeEdit: (pageIndex: number, itemId: string) => void
  addAnnotation: (ann: Annotation) => void
  updateAnnotation: (ann: Annotation) => void
  removeAnnotation: (id: string) => void
  reorderPages: (newOrder: number[]) => void
  clearDocument: () => void
}

const initialData = (): {
  document: PdfDocumentState | null
  textItems: Record<number, TextItem[]>
  activePageIndex: number
  zoom: number
  zoomMode: ZoomMode
  tool: Tool
  selection: EditorSelection | null
  isBusy: boolean
  strokeProps: { color: string; strokeWidth: number; opacity: number }
} => ({
  document: null,
  textItems: {},
  activePageIndex: 0,
  zoom: 1,
  zoomMode: 'fitWidth',
  tool: 'select',
  selection: null,
  isBusy: false,
  strokeProps: { color: '#2563eb', strokeWidth: 0.0025, opacity: 1 },
})

export const useEditorStore = create<EditorStore>()(
  temporal(
    (set) => ({
      ...initialData(),

      setDocument: (document) =>
        set({ document, activePageIndex: 0, selection: null, textItems: {} }),
      setTextItems: (pageIndex, items) =>
        set((s) => ({
          ...s,
          textItems: { ...s.textItems, [pageIndex]: items },
        })),
      setActivePage: (activePageIndex) => set({ activePageIndex }),
      setZoom: (zoom) => set({ zoom, zoomMode: 'custom' }),
      setZoomMode: (zoomMode) => set({ zoomMode }),
      setTool: (tool) => set({ tool, selection: tool === 'select' ? null : undefined }),
      setSelection: (selection) => set({ selection }),
      setBusy: (isBusy) => set({ isBusy }),
      setStrokeProps: (props) =>
        set((s) => ({ strokeProps: { ...s.strokeProps, ...props } })),

      addEdit: (pageIndex, edit) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          const edits = { ...doc.edits }
          edits[pageIndex] = [...(edits[pageIndex] ?? []), edit]
          return { document: { ...doc, edits } }
        }),

      removeEdit: (pageIndex, itemId) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          const edits = { ...doc.edits }
          edits[pageIndex] = (edits[pageIndex] ?? []).filter((e) => e.itemId !== itemId)
          return { document: { ...doc, edits } }
        }),

      addAnnotation: (ann) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          return { document: { ...doc, annotations: [...doc.annotations, ann] } }
        }),

      updateAnnotation: (ann) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          return {
            document: {
              ...doc,
              annotations: doc.annotations.map((a) => (a.id === ann.id ? ann : a)),
            },
          }
        }),

      removeAnnotation: (id) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          return {
            document: {
              ...doc,
              annotations: doc.annotations.filter((a) => a.id !== id),
            },
          }
        }),

      reorderPages: (newOrder) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          if (newOrder.length !== doc.pages.length) return s
          const oldToNew = Array.from({ length: newOrder.length }) as number[]
          newOrder.forEach((oldIdx, newIdx) => {
            oldToNew[oldIdx] = newIdx
          })
          const pages = newOrder.map((oldIdx) => doc.pages[oldIdx])
          const edits: Record<number, EditedText[]> = {}
          for (const [oldKeyStr, list] of Object.entries(doc.edits)) {
            const oldKey = Number(oldKeyStr)
            const newKey = oldToNew[oldKey] ?? oldKey
            edits[newKey] = (list ?? []).map((e) => ({ ...e, pageIndex: newKey }))
          }
          const annotations = doc.annotations.map((a) => ({
            ...a,
            pageIndex: oldToNew[a.pageIndex] ?? a.pageIndex,
          }))
          return { document: { ...doc, pages, edits, annotations } }
        }),

      clearDocument: () => set({ ...initialData() }),
    }),
    {
      partialize: (state) => ({
        document: state.document,
        tool: state.tool,
        activePageIndex: state.activePageIndex,
        zoom: state.zoom,
        zoomMode: state.zoomMode,
      }),
      limit: 100,
    } as Parameters<typeof temporal<EditorStore>>[1],
  ),
)