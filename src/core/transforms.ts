export interface NormalizedBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewBox {
  pageWidth: number
  pageHeight: number
  displayWidth: number
  displayHeight: number
  scale: number
}

/**
 * Sistema de transformación de coordenadas centralizado.
 *
 * Tres dominios:
 *  - PDF  -> coordenadas PDF (origen Y bottom-left, crece hacia arriba)
 *  - Normal -> [0,1] con origen top-left de la página (dominio canónico intermedio)
 *  - Web  -> pixels CSS del canvas renderizado (origen top-left)
 *
 * Todo el editor pasa por `[0,1]`: página -> web -> pdf.
 */
export class ViewTransform {
  private readonly pageWidth: number
  private readonly pageHeight: number

  constructor(pageWidth: number, pageHeight: number) {
    this.pageWidth = pageWidth
    this.pageHeight = pageHeight
  }

  /** PDF -> Normalizado (top-left origin) */
  pdfToNormalized(x: number, yBottom: number, width: number, height: number): NormalizedBox {
    return {
      x: x / this.pageWidth,
      y: 1 - (yBottom + height) / this.pageHeight,
      width: width / this.pageWidth,
      height: height / this.pageHeight,
    }
  }

  /** Normalizado -> PDF (bottom-left origin) */
  normalizedToPdf(box: NormalizedBox): { x: number; y: number; width: number; height: number } {
    return {
      x: box.x * this.pageWidth,
      y: (1 - box.y - box.height) * this.pageHeight,
      width: box.width * this.pageWidth,
      height: box.height * this.pageHeight,
    }
  }

  /** Normalizado -> Web (pixels del viewport, escalado por display) */
  normalizedToWeb(box: NormalizedBox, displayWidth: number, displayHeight: number): NormalizedBox {
    return {
      x: box.x * displayWidth,
      y: box.y * displayHeight,
      width: box.width * displayWidth,
      height: box.height * displayHeight,
    }
  }

  /** Web (pixels) -> Normalizado */
  webToNormalized(x: number, y: number, displayWidth: number, displayHeight: number): NormalizedBox {
    return {
      x: x / displayWidth,
      y: y / displayHeight,
      width: 0,
      height: 0,
    }
  }
}

/** Calcula dimensiones de display para una escala (zoom) dada */
export function displayForScale(
  pageWidth: number,
  pageHeight: number,
  scale: number,
): ViewBox {
  return {
    pageWidth,
    pageHeight,
    displayWidth: pageWidth * scale,
    displayHeight: pageHeight * scale,
    scale,
  }
}