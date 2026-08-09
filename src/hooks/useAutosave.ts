import { useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { clearDraft, saveDraft } from '@/store/autosave'
import type { PdfEngine } from '@/core/PdfEngine'

/**
 * Autoguardado (Fase 6.4): persiste el documento en localStorage con debounce.
 * Guarda también los bytes del PDF original para poder restaurar el editor.
 */
export function useAutosave(engine: PdfEngine | null, delayMs = 800) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!engine) {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      return
    }
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (state.document === prev.document) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const doc = useEditorStore.getState().document
        const bytes = engine.bytes
        if (doc && bytes) saveDraft(doc, bytes)
      }, delayMs)
    })
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [engine, delayMs])
}

export function clearAutosave() {
  clearDraft()
}