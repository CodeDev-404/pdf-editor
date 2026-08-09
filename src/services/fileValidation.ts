export async function isPdfFile(file: File): Promise<boolean> {
  if (file.type === 'application/pdf') return true
  if (file.name.toLowerCase().endsWith('.pdf')) return true
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  let sig = ''
  for (const byte of head) sig += String.fromCharCode(byte)
  return sig === '%PDF-'
}

export async function assertIsPdfFile(file: File): Promise<void> {
  if (!(await isPdfFile(file))) {
    throw new Error('Solo se admiten archivos PDF')
  }
}