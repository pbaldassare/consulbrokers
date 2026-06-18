## Problema
Il portale cliente non riesce ad aprire un nuovo sinistro. Errore DB:
`new row for relation "sinistri" violates check constraint "sinistri_stato_check"`.

## Causa
Il check constraint `sinistri_stato_check` ammette solo:
`aperto, in_lavorazione, in_attesa_documenti, chiuso, respinto`.

Ma:
- l'edge function `gestione-sinistri` (azione `crea`) inserisce stato `in_valutazione` quando il sinistro è aperto dal cliente;
- il resto del codice (badge, transizioni, zod schema) usa anche `in_liquidazione`.

Quindi il constraint è disallineato rispetto agli stati reali del dominio.

## Fix
Migrazione SQL che ricrea il check constraint con tutti gli stati validi:

```
ALTER TABLE public.sinistri DROP CONSTRAINT sinistri_stato_check;
ALTER TABLE public.sinistri ADD CONSTRAINT sinistri_stato_check
  CHECK (stato IN ('in_valutazione','aperto','in_lavorazione',
                   'in_attesa_documenti','in_liquidazione','chiuso','respinto'));
```

Nessuna modifica frontend/edge function: la enum nello zod schema è già corretta.

## Verifica
Riprovare "Apri nuovo sinistro" dal portale cliente → deve creare il record con stato `in_valutazione` senza errori.
