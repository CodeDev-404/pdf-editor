export interface SignaturePayload {
  /** marca de tiempo (ms desde epoch) */
  timestamp: number
  /** SHA-256 del contenido firmado */
  hash: string
  /** firma ECDSA P-256 (base64url) */
  signature: string
  /** clave pública (SPKI, base64url) para verificación */
  publicKey: string
  /** etiqueta del firmante */
  name?: string
  /** versión del formato de firma */
  format: 'xof-digsig-v1'
}

export interface SignedDocument {
  payload: SignaturePayload
  /** base64 del payload completo (para verificación independiente) */
  payloadRaw: string
}

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
}

async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key)
  return b64url(new Uint8Array(spki))
}

async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    b64urlToBytes(spkiB64).buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
}

/** Comprueba que WebCrypto esté disponible y soporte ECDSA (requiere contexto seguro). */
export function isCryptoSupported(): boolean {
  try {
    return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Firma un buffer: genera un par ECDSA P-256 y produce un payload con el
 * hash SHA-256 del contenido y la firma. No modifica el buffer.
 */
export async function signBytes(
  bytes: Uint8Array,
  opts: { name?: string; onProgress?: (p: number) => void } = {},
): Promise<SignedDocument> {
  opts.onProgress?.(0.2)
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  )
  opts.onProgress?.(0.4)

  const hash = await sha256(bytes)
  opts.onProgress?.(0.6)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  )
  opts.onProgress?.(0.8)

  const payload: SignaturePayload = {
    timestamp: Date.now(),
    hash: b64url(hash),
    signature: b64url(new Uint8Array(signature)),
    publicKey: await exportPublicKey(keyPair.publicKey),
    name: opts.name,
    format: 'xof-digsig-v1',
  }

  const payloadRaw = btoa(JSON.stringify(payload))
  opts.onProgress?.(1)
  return { payload, payloadRaw }
}

/** Verifica la firma contra el contenido dado. Devuelve detalles del resultado. */
export async function verifyBytes(
  bytes: Uint8Array,
  payload: SignaturePayload,
): Promise<{ valid: boolean; hashMatches: boolean; name?: string; timestamp: number }> {
  const hash = await sha256(bytes)
  const hashMatches = b64url(hash) === payload.hash
  if (!hashMatches) {
    return { valid: false, hashMatches: false, name: payload.name, timestamp: payload.timestamp }
  }
  try {
    const publicKey = await importPublicKey(payload.publicKey)
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      b64urlToBytes(payload.signature).buffer as ArrayBuffer,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    )
    return {
      valid: ok && hashMatches,
      hashMatches,
      name: payload.name,
      timestamp: payload.timestamp,
    }
  } catch {
    return { valid: false, hashMatches, name: payload.name, timestamp: payload.timestamp }
  }
}

/** Extrae y decodifica un payload de firma a partir de su código base64. */
export function decodePayload(raw: string): SignaturePayload | null {
  try {
    const json = atob(raw)
    const obj = JSON.parse(json) as SignaturePayload
    if (obj?.format !== 'xof-digsig-v1' || !obj.hash || !obj.signature || !obj.publicKey) return null
    return obj
  } catch {
    return null
  }
}