## Problema

Nelle select di `Cliente & Sede` (Sede/Ufficio, Account Executive, Produttore, Specialist) non c'è un modo esplicito per svuotare un valore già scelto: se si seleziona per errore una sede o un AE, non si riesce più a tornare allo stato "vuoto" senza ricaricare la pagina.

## Fix

**`src/components/SearchableSelect.tsx`** — aggiungere prop opzionale `clearable?: boolean`. Quando `true` e `value` è valorizzato, mostrare in cima alla lista una voce `— Nessuno —` che chiama `onValueChange("")` e chiude il popover. Default `false` (zero impatto sui chiamanti esistenti).

**`src/pages/ImmissionePolizzaPage.tsx`** (linee 1255-1300) — passare `clearable` alle 4 select: Sede (Ufficio), Account Executive, Produttore, Specialist.

## Note

- Pattern non distruttivo: tutti gli altri usi di `SearchableSelect` restano invariati.
- "Sede (Ufficio) *" resta obbligatoria a livello di salvataggio, ma diventa svuotabile per correggere errori prima del submit.
- Bump `public/version.json`.

## Verifica

Su `/portafoglio/immissione?clienteId=...`: selezionare poi cliccare `— Nessuno —` nelle 4 select → trigger torna a placeholder; nessun errore console.
