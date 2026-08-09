import { useState } from 'react'
import { FileSignature, ShieldCheck, ShieldAlert, X, Loader2 } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { buildEditedPdf, attachSignatureBlock, extractSignatureBlock } from '@/export/buildPdf'
import { signBytes, verifyBytes, decodePayload, isCryptoSupported } from '@/crypto/digitalSignature'
import type { PdfEngine } from '@/core/PdfEngine'

interface DigitalSignatureDialogProps {
  open: boolean
  onClose: () => void
  engine: PdfEngine
}

type Phase = 'idle' | 'signing' | 'signed' | 'verifying' | 'verified'

/**
 * Firma digital criptográfica (Fase 9.4): genera un par de claves ECDSA en
 * el dispositivo, sella el hash del PDF exportado (SHA-256) y adjunta el
 * payload en un bloque de cierre del propio PDF. Permite verificar el
 * resultado de forma independiente.
 *
 * NOTA: es una firma con hash e identidad en-clave (no PAdES). Para firmas
 * con validez legal completa se necesitaría un PKI/TSP externo.
 */
export function DigitalSignatureDialog({ open, onClose, engine }: DigitalSignatureDialogProps) {
  const pdfDoc = useEditorStore((s) => s.document)
  const [name, setName] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [verifyText, setVerifyText] = useState<string>('')
  const [payloadText, setPayloadText] = useState<string>('')
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null)
  const [verifyOk, setVerifyOk] = useState<boolean | null>(null)

  if (!open) return null

  if (!isCryptoSupported()) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-amber-600">
            La firma digital requiere WebCrypto en un contexto seguro (https o localhost).
          </p>
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="rounded-md border border-neutral-300 px-4 py-1.5 text-xs hover:bg-neutral-50">Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  const handleSign = async () => {
    if (!pdfDoc || !engine.bytes) return
    setPhase('signing')
    setError(null)
    try {
      const bytes = await buildEditedPdf(engine.bytes, pdfDoc.pages, pdfDoc, {
        scale: 1,
        includeAnnotations: true,
        includeEdits: true,
        compressed: true,
      })
      const signed = await signBytes(bytes, { name: name.trim() || undefined })
      const signedPdf = attachSignatureBlock(bytes, signed.payloadRaw)
      setPayloadText(JSON.stringify(signed.payload, null, 2))

      const blob = new Blob([signedPdf as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfDoc.name.replace(/\.pdf$/i, '') + '-firmado.pdf'
      a.click()
      URL.revokeObjectURL(url)
      setPhase('signed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al firmar')
      setPhase('idle')
    }
  }

  const handleVerify = async (file: File) => {
    setPhase('verifying')
    setVerifyFeedback(null)
    setVerifyOk(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const raw = extractSignatureBlock(bytes)
      if (!raw) {
        setVerifyFeedback('Este PDF no contiene un bloque de firma digital.')
        setVerifyOk(false)
        setPhase('verified')
        return
      }
      const payload = decodePayload(raw)
      if (!payload) {
        setVerifyFeedback('El bloque de firma no es válido o está corrupto.')
        setVerifyOk(false)
        setPhase('verified')
        return
      }
      const res = await verifyBytes(bytes, payload)
      setVerifyText(JSON.stringify(payload, null, 2))
      setVerifyFeedback(
        res.valid
          ? 'Firma válida: el hash coincide y la firma ECDSA se verificó correctamente.'
          : 'Firma NO válida: el contenido fue modificado después de firmarse (hash no coincide).',
      )
      setVerifyOk(res.valid)
      setPhase('verified')
    } catch {
      setVerifyFeedback('No se pudo verificar: error al procesar el archivo.')
      setVerifyOk(false)
      setPhase('verified')
    }
  }

  const busy = phase === 'signing' || phase === 'verifying'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-800">
            <FileSignature size={16} className="text-neutral-500" />
            Firma digital criptográfica
          </h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-400 hover:bg-neutral-100" title="Cerrar">
            <X size={18} />
          </button>
        </div>

        {phase === 'idle' || phase === 'signed' || phase === 'signing' ? (
          <section>
            <p className="mb-3 text-xs text-neutral-500">
              Genera un par de claves ECDSA P-256 en tu dispositivo, sella el
              hash del PDF (SHA-256) y lo descarga firmado. La clave pública
              viaja en el propio archivo para poder verificarla después.
            </p>
            <label className="mb-1 block text-xs text-neutral-600">Firmante (opcional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre o entidad"
              className="mb-4 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
            />
            {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Cerrar
              </button>
              <button
                onClick={() => void handleSign()}
                disabled={busy}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />}
                {busy ? 'Firmando…' : 'Exportar PDF firmado'}
              </button>
            </div>
            {phase === 'signed' && (
              <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2">
                <p className="text-xs font-medium text-emerald-700">
                  <ShieldCheck size={13} className="mr-1 inline" />
                  PDF firmado descargado.
                </p>
                <textarea
                  readOnly
                  value={payloadText}
                  rows={5}
                  className="mt-2 w-full rounded-md border border-emerald-200 bg-white p-2 font-mono text-[10px] text-neutral-600 outline-none"
                />
              </div>
            )}
          </section>
        ) : (
          <section>
            <p className="mb-3 text-xs text-neutral-500">
              Selecciona un PDF firmado para recalcular su hash y verificar la firma.
            </p>
            <label
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 px-4 py-5 text-center text-xs text-neutral-500 hover:border-blue-400 hover:bg-blue-50"
            >
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleVerify(f)
                }}
              />
              {busy ? (
                <Loader2 size={18} className="animate-spin text-blue-500" />
              ) : (
                <ShieldCheck size={18} className="text-neutral-400" />
              )}
              <span className="mt-1">{busy ? 'Verificando…' : 'Haz clic para elegir archivo'}</span>
            </label>
            {verifyFeedback && (
              <p className={`mt-3 flex items-start gap-1 text-xs ${verifyOk ? 'text-emerald-700' : 'text-red-600'}`}>
                {verifyOk ? <ShieldCheck size={14} className="mt-0.5 shrink-0" /> : <ShieldAlert size={14} className="mt-0.5 shrink-0" />}
                {verifyFeedback}
              </p>
            )}
            {verifyText && (
              <textarea
                readOnly
                value={verifyText}
                rows={5}
                className="mt-2 w-full rounded-md border border-neutral-200 bg-neutral-50 p-2 font-mono text-[10px] text-neutral-600 outline-none"
              />
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPhase('idle')}
                className="rounded-md border border-neutral-300 px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                Firmar otro
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}