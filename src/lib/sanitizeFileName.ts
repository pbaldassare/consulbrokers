/**
 * Sanitizza un nome file per essere usato come chiave Supabase Storage.
 * Supabase rifiuta chiavi con caratteri non-ASCII o spazi ("Invalid key").
 * Il nome originale (con accenti) va conservato altrove (es. documenti.nome_file).
 */
export function sanitizeStorageFileName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // rimuove diacritici (ò → o)
      .replace(/[^a-zA-Z0-9._-]+/g, "_") // spazi e simboli → _
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "file"
  );
}
