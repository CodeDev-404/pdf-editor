import type { PdfDocumentState } from '@/types'

const KEY = 'pdf-editor:autosave'

export interface Draft {
  doc: PdfDocumentState
  /** bytes del PDF original en base64 (para reconstruir el engine) */
  bytes: string
  savedAt: number
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('btoa no disponible')
  }
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    for (let j = 0; j < slice.length; j++) binary += String.fromCharCode(slice[j])
  }
  return globalThis.btoa(binary)
}

export function saveDraft(doc: PdfDocumentState, bytes: Uint8Array) {
  try {
    const draft: Draft = { doc, bytes: bytesToBase64(bytes), savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as Draft
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atobCompat(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function atobCompat(b64: string): string {
  if (typeof globalThis.atob === 'function') return globalThis.atob(b64)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let buffer = 0
  let bits = 0
  for (const c of b64) {
    if (c === '=') break
    const idx = chars.indexOf(c)
    if (idx === -1) continue
    buffer = (buffer << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      result += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }
  return result
}

export function draftToBytes(draft: Draft): Uint8Array {
  return base64ToBytes(draft.bytes)
}