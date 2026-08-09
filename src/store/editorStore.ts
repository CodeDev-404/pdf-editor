import { create } from 'zustand'
import { temporal } from 'zundo'
import type {
  Annotation,
  EditedText,
  PageInfo,
  PdfDocumentState,
  SearchMatch,
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
  search: {
    query: string
    matches: SearchMatch[]
    activeMatch: number
    active: boolean
  }

  setDocument: (doc: PdfDocumentState) => void
  setTextItems: (pageIndex: number, items: TextItem[]) => void
  setActivePage: (index: number) => void
  setZoom: (zoom: number) => void
  setZoomMode: (mode: ZoomMode) => void
  setTool: (tool: Tool) => void
  setSelection: (sel: EditorSelection | null) => void
  setBusy: (busy: boolean) => void
  setStrokeProps: (props: Partial<{ color: string; strokeWidth: number; opacity: number }>) => void
  setSearch: (query: string, matches: SearchMatch[]) => void
  setActiveMatch: (index: number) => void
  closeSearch: () => void

  addEdit: (pageIndex: number, edit: EditedText) => void
  removeEdit: (pageIndex: number, itemId: string) => void
  addAnnotation: (ann: Annotation) => void
  updateAnnotation: (ann: Annotation) => void
  removeAnnotation: (id: string) => void
  setAnnotationHidden: (id: string, hidden: boolean) => void
  moveAnnotation: (id: string, dir: -1 | 1) => void
  reorderAnnotation: (id: string, targetIndex: number) => void
  reorderPages: (newOrder: number[]) => void
  addBlankPage: (afterIndex: number) => void
  deletePage: (index: number) => void
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
  search: {
    query: string
    matches: SearchMatch[]
    activeMatch: number
    active: boolean
  }
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
  search: { query: '', matches: [], activeMatch: 0, active: false },
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

      setSearch: (query, matches) =>
        set({
          search: {
            query,
            matches,
            activeMatch: matches.length > 0 ? 0 : -1,
            active: query.length > 0,
          },
        }),

      setActiveMatch: (index) =>
        set((s) => ({
          search: {
            ...s.search,
            activeMatch:
              s.search.matches.length === 0
                ? -1
                : ((index % s.search.matches.length) + s.search.matches.length) %
                  s.search.matches.length,
          },
        })),

      closeSearch: () =>
        set({ search: { query: '', matches: [], activeMatch: -1, active: false } }),

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

      setAnnotationHidden: (id, hidden) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          return {
            document: {
              ...doc,
              annotations: doc.annotations.map((a) => (a.id === id ? { ...a, hidden } : a)),
            },
          }
        }),

      moveAnnotation: (id, dir) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          const list = [...doc.annotations]
          const i = list.findIndex((a) => a.id === id)
          if (i < 0) return s
          const j = i + dir
          if (j < 0 || j >= list.length) return s
          ;[list[i], list[j]] = [list[j], list[i]]
          return { document: { ...doc, annotations: list } }
        }),

      reorderAnnotation: (id, targetIndex) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          const list = [...doc.annotations]
          const i = list.findIndex((a) => a.id === id)
          if (i < 0 || targetIndex < 0 || targetIndex >= list.length) return s
          const [item] = list.splice(i, 1)
          list.splice(targetIndex, 0, item)
          return { document: { ...doc, annotations: list } }
        }),

      reorderPages: (newOrder) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          if (newOrder.length !== doc.pages.length) return s
          const positions = new Map<number, PageInfo>()
          for (const p of doc.pages) positions.set(p.index, p)
          const pages = newOrder.map((physIdx) => positions.get(physIdx) ?? doc.pages[physIdx])
          return { document: { ...doc, pages } }
        }),

      addBlankPage: (afterIndex) =>
        set((s) => {
          const doc = s.document
          if (!doc) return s
          const template = doc.pages[afterIndex] ?? doc.pages[doc.pages.length - 1]
          if (!template) return s
          const maxIdx = doc.pages.reduce((m, p) => Math.max(m, p.index), -1)
          const blank: PageInfo = {
            index: maxIdx + 1,
            width: template.width,
            height: template.height,
            rotation: 0,
            blank: true,
          }
          const pages = [...doc.pages]
          pages.splice(afterIndex + 1, 0, blank)
          return {
            document: {
              ...doc,
              pageCount: pages.length,
              pages,
            },
            activePageIndex: afterIndex + 1,
          }
        }),

      deletePage: (targetIndex) =>
        set((s) => {
          const doc = s.document
          if (!doc || doc.pages.length <= 1) return s
          const gone = doc.pages[targetIndex]
          const pages = doc.pages.filter((_, i) => i !== targetIndex)
          const edits: Record<number, EditedText[]> = {}
          for (const [key, list] of Object.entries(doc.edits)) {
            const pageIndex = Number(key)
            if (gone && pageIndex === gone.index) continue
            edits[pageIndex] = (list ?? []).map((e) => ({ ...e, pageIndex }))
          }
          const annotations = doc.annotations.filter((a) => !(gone && a.pageIndex === gone.index))
          return {
            document: {
              ...doc,
              pageCount: pages.length,
              pages,
              edits,
              annotations,
            },
            activePageIndex: Math.min(s.activePageIndex, pages.length - 1),
          }
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