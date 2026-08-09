import { describe, expect, it, beforeAll } from 'vitest'
import { webcrypto } from 'node:crypto'
import { signBytes, verifyBytes, decodePayload, isCryptoSupported } from './digitalSignature'
import { attachSignatureBlock, extractSignatureBlock } from '@/export/buildPdf'

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    ;(globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto
  }
})

describe('digitalSignature', () => {
  it('firma y verifica correctamente un contenido', async () => {
    const content = new TextEncoder().encode('contenido del PDF sacara firma')
    const signed = await signBytes(content, { name: 'Equipo Legal' })
    expect(signed.payload.format).toBe('xof-digsig-v1')
    expect(signed.payload.name).toBe('Equipo Legal')
    expect(signed.payload.hash.length).toBeGreaterThan(0)

    const res = await verifyBytes(content, signed.payload)
    expect(res.valid).toBe(true)
    expect(res.hashMatches).toBe(true)
  })

  it('detecta contenido modificado (firma inválida)', async () => {
    const content = new TextEncoder().encode('firma sobre A')
    const signed = await signBytes(content)
    const tampered = new TextEncoder().encode('firma sobre B')
    const res = await verifyBytes(tampered, signed.payload)
    expect(res.valid).toBe(false)
    expect(res.hashMatches).toBe(false)
  })

  it('adjunta y extrae el bloque de firma de un PDF', () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\n...%%EOF\n')
    const signed = attachSignatureBlock(bytes, 'pAYLOADEjemplo')
    expect(extractSignatureBlock(signed)).toBe('pAYLOADEjemplo')
  })

  it('decodifica payloads válidos y rechaza inválidos', async () => {
    const content = new TextEncoder().encode('abc')
    const signed = await signBytes(content)
    const decoded = decodePayload(signed.payloadRaw)
    expect(decoded?.hash).toBe(signed.payload.hash)
    expect(decodePayload('not-json')).toBeNull()
  })

  it('detecta soporte de WebCrypto', () => {
    expect(isCryptoSupported()).toBe(true)
  })
})