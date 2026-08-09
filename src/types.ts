export interface PageInfo {
  index: number
  width: number
  height: number
  rotation: number
}

export interface TextItem {
  id: string
  pageIndex: number
  str: string
  /** coordenadas normalizadas [0,1] de la caja del bloque (origen top-left del viewport) */
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  fontSizePx: number
  fontFamily: string
  color: string
  hasEOL: boolean
}

export interface EditedText {
  itemId: string
  pageIndex: number
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  text: string
  fontSizePx: number
  fontFamily: string
  color: string
}

export interface Annotation {
  id: string
  pageIndex: number
  type: 'highlight' | 'rect' | 'line' | 'arrow' | 'ink' | 'stamp' | 'sticky' | 'signature'
  /** box normalizado [0,1] */
  box: { x: number; y: number; width: number; height: number }
  color: string
  /** ancho de trazo en unidades normalizadas [0,1] del alto de la página */
  strokeWidth?: number
  opacity?: number
  points?: Array<{ x: number; y: number }>
  stampImage?: string
  text?: string
}

export interface UndoState {
  edits: Record<number, EditedText[]>
  annotations: Annotation[]
}

export interface PdfDocumentState {
  name: string
  pageCount: number
  pages: PageInfo[]
  edits: Record<number, EditedText[]>
  annotations: Annotation[]
}

export type Tool =
  | 'select'
  | 'text'
  | 'highlight'
  | 'rectangle'
  | 'line'
  | 'arrow'
  | 'ink'
  | 'sticky'
  | 'stamp'
  | 'signature'

export type ZoomMode = 'fitWidth' | 'fitPage' | 'custom'