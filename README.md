# PDF Editor

Editor de PDF gratuito y 100% local que funciona en el navegador. Carga, edita texto, anota y exporta documentos sin que los datos salgan nunca de tu dispositivo.

## 🌐 Demo

**https://codedev-404.github.io/pdf-editor/**

## Características

- **Carga de PDFs** con renderizado por página vía pdf.js (vista de miniaturas con scroll virtualizado)
- **Edición de texto** WYSIWYG: clic sobre un bloque de texto para reescribirlo (cover-and-replace al exportar)
- **Anotaciones**: resaltado, rectángulo, línea, flecha, dibujo libre, notas adhesivas, sellos y firma digital (trazada con el cursor o dedo)
- **Barra de propiedades** contextual (color, grosor, opacidad) para trazos y anotaciones
- **Reordenar páginas** por arrastrar y soltar desde el panel de miniaturas
- **Exportación** con opciones de escala, compresión y qué incluir (anotaciones / ediciones)
- **Autoguardado** en localStorage con restauración de borrador
- **Atajos de teclado**: Ctrl/Cmd+Z deshacer, Ctrl+Y rehacer, Supr borrar anotación

Todo el procesamiento ocurre en el navegador con `pdf-lib` y `pdf.js`: el documento nunca se sube a ningún servidor.

## Stack

- React 19 + TypeScript + Vite
- `pdf-lib` para lectura/exportación de PDF
- `pdfjs-dist` para extracción de texto y renderizado
- `Konva` / `react-konva` para el lienzo de anotaciones
- `zustand` + `zundo` (historial undo/redo), `@dnd-kit` para el reordenamiento

## Desarrollo

```bash
npm install
npm run dev       # servidor de desarrollo
npm test          # tests unitarios (vitest)
npm run lint      # oxlint
npm run build     # compilación de producción
```

## Roadmap

- [x] Carga, renderizado y navegación de páginas
- [x] Edición de texto WYSIWYG + exportación
- [x] Anotaciones vectoriales, sellos y firma
- [x] Reordenar páginas y autoguardado
- [ ] OCR, firma criptográfica, colaboración en tiempo real