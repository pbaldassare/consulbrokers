# Due email per rapporto compagnia/agenzia

## Obiettivo
Ogni rapporto agenzia/compagnia deve avere due indirizzi email distinti:
1. **Email Messe a Cassa** — destinatario comunicazioni di messa in pagamento dalla compagnia
2. **Email Estratto Conto** — destinatario invio E/C agenzia

## Modifiche DB (`compagnia_rapporti`)
- Aggiunta colonna `email_messe_a_cassa text`
- Aggiunta colonna `email_estratto_conto text`
- Backfill: per **tutti i rapporti esistenti** valorizzo entrambe le colonne a `pscarpelli@gmail.com`
- Trigger di sync con `compagnie` aggiornato per propagare i nuovi campi sui rapporti principali (agenzia/direzione 1:1), così la coerenza è mantenuta.

Nota: il campo esistente `email_referente` resta com'è (referente persona), i nuovi due campi sono indirizzi funzionali separati.

## Modifiche UI
File: `src/components/compagnie/RapportiCompagniaDialog.tsx`
- Aggiunta nel form dialog di due input email affiancati nella sezione referente:
  - "Email Messe a Cassa" (con hint: usata per ricevere comunicazioni di messa in pagamento)
  - "Email Estratto Conto" (con hint: usata per invio E/C agenzia)
- Validazione formato email (non bloccante se vuoto, ma raccomandato)
- In tabella rapporti aggiungo tooltip/colonna compatta o le mostro solo in dialog (per non rompere il layout). Default: solo in dialog + icona ✉ nella riga se entrambe presenti.

## Note
- Nessuna logica di invio cambia ora: i campi vengono solo persistiti. Il wiring verso `gestione-rimessa` (messa a cassa) e `ECAgenziaPdfPage` (E/C) può essere fatto in un passo successivo se vuoi.
- Se confermi, procedo con migration + edit del dialog.
