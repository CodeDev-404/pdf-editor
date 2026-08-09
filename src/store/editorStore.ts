import { create } from 'zustand'
import { temporal } from 'zundo'
import type {
  Annotation,
  EditedText,
  PageInfo,
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