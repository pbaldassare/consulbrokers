# Email Messe a Cassa / Estratto Conto a livello di Compagnia

## Obiettivo
I due indirizzi email (Messe a Cassa, Estratto Conto) devono essere presenti **anche sulla form della Compagnia/Agenzia/Broker/Direzione**, non solo nei rapporti. Default per tutte le righe esistenti (compagnie + rapporti): `pscarpelli@consulbrokers.it`.

## DB
1. `ALTER TABLE public.compagnie ADD COLUMN email_messe_a_cassa text, email_estratto_conto text`
2. Backfill `compagnie`: tutte le righe → `pscarpelli@consulbrokers.it` su entrambi i campi
3. Backfill `compagnia_rapporti`: aggiorno tutte le righe esistenti a `pscarpelli@consulbrokers.it` (sovrascrivendo il precedente default `pscarpelli@gmail.com`)

Nessuna logica di sync automatica tra `compagnie` e `compagnia_rapporti`: il rapporto può sovrascrivere l'email della compagnia madre, se vuoto cade sull'email della compagnia.

## UI
`src/pages/CompagnieList.tsx` (form Modifica/Nuova compagnia, tab **Anagrafica**):
- Aggiungo sezione "Indirizzi Email Funzionali" con due campi email affiancati:
  - "Email Messe a Cassa" (hint: comunicazioni di messa in pagamento dalla compagnia)
  - "Email Estratto Conto" (hint: invio E/C agenzia)
- Visibile per **tutti i tipi** (agenzia, broker, direzione, plurimandataria)
- Default in `formInit` = `pscarpelli@consulbrokers.it` per nuove compagnie

`RapportiCompagniaDialog.tsx`: già aggiornato nella scorsa iterazione, lascio inalterato (resta come override per-rapporto).

## Risultato
- Form Modifica Agenzia/Broker/Direzione/Plurimandataria mostra i due campi email
- Tutte le agenzie esistenti hanno già `pscarpelli@consulbrokers.it` salvato
- Tutti i rapporti esistenti hanno il nuovo default `pscarpelli@consulbrokers.it`
