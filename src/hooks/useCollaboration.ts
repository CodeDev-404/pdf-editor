import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import type { PdfDocumentState } from '@/types'

export const COLLAB_CHANNEL = 'pdf-editor:collab'

interface CollabMessage {
  kind: 'hello' | 'sync' | 'leave'
  /** clave de sesión compartida (pestaña del mismo documento) */
  session: string
  doc?: PdfDocumentState
  peer: string
}

let peerCounter = 0
function makePeerId(): string {
  return `peer-${Date.now().toString(36)}-${(peerCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Colaboración en tiempo real (Fase 9.5): sincroniza el documento entre
 * pestañas del mismo origen vía BroadcastChannel usando last-write-wins por
 * timestamp. Los peers también resultan compatibles con WebRTC en el futuro.
 *
 * Devuelve el número de pestañas/peers conectados a la misma sesión.
 */
export function useCollaboration(active: boolean): { peers: number; session: boolean } {
  const [peers, setPeers] = useState(0)
  const [session, setSession] = useState(false)
  const peersRef = useRef<Map<string, number>>(new Map())
  const channelRef = useRef<BroadcastChannel | null>(null)
  const sessionRef = useRef<string>('')
  const applyingRemoteRef = useRef(false)

  useEffect(() => {
    if (!active) return
    const doc = useEditorStore.getState().document
    if (!doc) return

    // La "sesión" es la pestaña principal; en un despliegue multi-dispositivo
    // sería el identificador de documento compartido.
    const ss = doc.name ?? 'default'
    sessionRef.current = ss
    const myPeer = makePeerId()

    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(COLLAB_CHANNEL)
    } catch {
      return // BroadcastChannel no disponible: sin colaboración
    }
    channelRef.current = channel

    const touch = (peerId: string) => peersRef.current.set(peerId, Date.now())
    const refresh = () => setPeers(peersRef.current.size)

    const handleMessage = (event: MessageEvent<CollabMessage>) => {
      const msg = event.data
      if (!msg || msg.session !== ss) return
      if (msg.kind === 'leave') {
        peersRef.current.delete(msg.peer)
        refresh()
        return
      }
      if (msg.kind === 'hello') {
        touch(msg.peer)
        refresh()
        if (msg.peer !== myPeer) {
          const localDoc = useEditorStore.getState().document ?? undefined
          channel?.postMessage({ kind: 'sync', session: ss, doc: localDoc, peer: myPeer } satisfies CollabMessage)
        }
        return
      }
      if (msg.kind === 'sync' && msg.doc && msg.peer !== myPeer) {
        touch(msg.peer)
        refresh()
        const local = useEditorStore.getState().document
        const remoteStamp = msg.doc.updatedAt ?? 0
        const localStamp = local?.updatedAt ?? 0
        if (remoteStamp >= localStamp) {
          applyingRemoteRef.current = true
          useEditorStore.getState().patchDocument({ ...msg.doc })
          applyingRemoteRef.current = false
        }
      }
    }

    channel.addEventListener('message', handleMessage)

    // anunciarnos y avisar a otros peers
    channel.postMessage({ kind: 'hello', session: ss, peer: myPeer } satisfies CollabMessage)
    setSession(true)

    const interval = window.setInterval(() => {
      channel?.postMessage({ kind: 'hello', session: ss, peer: myPeer } satisfies CollabMessage)
    }, 4000)

    // difundir cambios locales (con un pequeño debounce para agrupar ráfagas)
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      if (applyingRemoteRef.current) return
      const doc = state.document
      if (doc && doc !== prev.document) {
        channel?.postMessage({ kind: 'sync', session: ss, doc, peer: myPeer } satisfies CollabMessage)
      }
    })

    return () => {
      window.clearInterval(interval)
      unsubscribe()
      channel?.postMessage({ kind: 'leave', session: ss, peer: myPeer } satisfies CollabMessage)
      channel?.close()
    }
  }, [active])

  return { peers, session }
}