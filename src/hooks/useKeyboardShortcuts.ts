import { useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'

/**
 * Atajos de teclado globales (Fase 5):
 * - Ctrl/Cmd+Z -> deshacer
 * - Ctrl/Cmd+Y o Ctrl/Cmd+Shift+Z -> rehacer
 * - Supr -> borrar anotación seleccionada
 * - Escape -> quitar selección
 */
export function useKeyboardShortcuts(onUndo: () => void, onRedo: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) onRedo()
        else onUndo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        onRedo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = useEditorStore.getState().selection
        if (sel?.type === 'annotation' && sel.id) {
          e.preventDefault()
          useEditorStore.getState().removeAnnotation(sel.id)
          useEditorStore.getState().setSelection(null)
        }
        return
      }
      if (e.key === 'Escape') {
        useEditorStore.getState().setSelection(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onUndo, onRedo])
}