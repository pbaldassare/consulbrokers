## Problema

La pagina "Storico E/C Agenzie" legge da `documenti` filtrando `categoria = 'EC Agenzia'`. La funzione `storePdfFor` in `AgenzieInPagamentoPage.tsx`:

1. fa `upload(..., { upsert: true })` sul bucket `rimesse-pdf` → idempotente (sovrascrive),
2. fa `update` di `rimessa_premi.pdf_url` → idempotente,
3. **fa SEMPRE `INSERT` in `documenti`** → NON idempotente.

Se l'utente clicca "Conferma pagamento" due volte (o ritenta dopo un errore — es. il check constraint `in_pagamento` mancante di prima), il PDF viene riarchiviato e nasce una **seconda riga `documenti`** → due voci in Storico per la stessa rimessa.

## Fix

**`src/pages/contabilita/AgenzieInPagamentoPage.tsx` — `storePdfFor`**

Prima dell'INSERT in `documenti` cercare un record esistente per quella rimessa:

```ts
const { data: existing } = await supabase
  .from("documenti")
  .select("id")
  .eq("bucket_name", "rimesse-pdf")
  .eq("path_storage", path)
  .maybeSingle();

if (existing) {
  await supabase.from("documenti")
    .update({ caricato_da: user?.id || null, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
} else {
  await supabase.from("documenti").insert({ ...campi attuali... });
}
```

Così:
- prima conferma → INSERT,
- successive conferme/retry della stessa rimessa → UPDATE dello stesso record,
- Storico mostra una sola riga per rimessa.

Inoltre il bottone "Conferma pagamento" del dialog è già `disabled={confermaPagamentoMutation.isPending}`, quindi il doppio click in-flight è già coperto; il problema vero erano i retry dopo errore, gestiti dal blocco sopra.

## Pulizia dati esistenti (opzionale)

Dalla screenshot esistono già righe duplicate (es. 28/05 14:18 e 26/05 08:41 per stessa agenzia/rimessa). Le tengo o le pulisco con una migration che cancella le duplicate più vecchie per `(bucket_name='rimesse-pdf', path_storage)` lasciando la più recente?

## Fuori scopo

Non tocco `ECAgenziaPdfPage.handleSalva` (E/C manuale, non legato a rimessa): lì ogni click salva volutamente un PDF datato `Date.now()_name`, è progettato come export.