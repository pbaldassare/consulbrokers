/** Limite upload documenti (polizze, sinistri, clienti, allegati, ecc.) */
export const MAX_DOCUMENT_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_DOCUMENT_UPLOAD_MB = 25;

export function isDocumentUploadTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_DOCUMENT_UPLOAD_BYTES;
}

export function documentUploadTooLargeMessage(): string {
  return `Il file supera il limite di ${MAX_DOCUMENT_UPLOAD_MB} MB`;
}
