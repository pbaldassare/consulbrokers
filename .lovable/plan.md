

## Piano: rimozione "Chiusura Contabile" e "Avvisi Incasso"

Rimuovo entrambe le voci dal modulo Contabilità (sidebar, route, breadcrumb, file pagina).

### Modifiche

1. **`src/components/AppSidebar.tsx`** — rimuovo le righe 164 e 165 (voci sidebar).
2. **`src/routes/contabilita.tsx`** — rimuovo le route `/contabilita/avvisi-incasso` (riga 31) e `/contabilita/chiusura-contabile` (riga 35), più l'import di `ChiusuraContabile` e `Bell`/`Lock` se non più usati.
3. **`src/components/PageBreadcrumb.tsx`** — rimuovo l'entry `"avvisi-incasso"` (riga 54). Lascio il resto.
4. **`src/pages/contabilita/ChiusuraContabile.tsx`** — elimino il file (non più referenziato).

### Note
- La tabella DB `chiusure_contabili` resta intatta (nessuna migration). Se in futuro vorrai eliminarla, basta chiedere.
- Nessun'altra pagina referenzia i percorsi rimossi (verificato con search).

