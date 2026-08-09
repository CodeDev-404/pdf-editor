import CSSMatrix from 'dommatrix'

const DOMMatrixPolyfill = CSSMatrix as unknown as typeof DOMMatrix
;(globalThis as unknown as { DOMMatrix: typeof DOMMatrix }).DOMMatrix = DOMMatrixPolyfill