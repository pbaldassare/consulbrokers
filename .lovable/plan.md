# Pulsante "Invia E/C via Email" — pagina E/C Agenzie

Aggiungere un nuovo pulsante **"Invia Mail"** accanto a "Stampa E/C" in ogni riga agenzia di `/contabilita/ec-agenzia`, che invia all'agenzia il PDF dell'estratto conto con un testo email di default.

## Scope

Solo `src/pages/contabilita/ECCompagniaContabPage.tsx` (vista E/C Agenzie, quando `isAgenzia = true`). La vista E/C Compagnia non riceve il pulsante.

## UI

In `ECCompagniaContabPage.tsx` (~riga 588), tra "Stampa E/C" e "Metti in pagamento":

```
[ Stampa E/C ]  [ Invia Mail ]  [ Metti in pagamento ]
```

- Icona `Mail` (lucide-react), `size="sm" variant="outline" className="h-7 text-xs gap-1"`.
- Disabilitato durante l'invio; spinner inline + `toast.success` / `toast.error`.
- Solo se `isAgenzia` (stessa pagina serve anche E/C Compagnia).

## Risoluzione destinatario

Riusare la chain già usata da `notifica-messa-cassa-agenzia`:
1. `compagnia_rapporti.email_messe_a_cassa` (rapporto pertinente, se identificabile dai titoli) 
2. `compagnie.email_messe_a_cassa`
3. Fallback: `pscarpelli@consulbrokers.it`

Se non c'è alcun rapporto chiaramente identificabile, usare direttamente compagnia → fallback.

## Flusso invio

Tutto lato client (riusiamo le primitive esistenti, niente nuova edge function):

1. Click → fetch `compagnia` (+ eventuale `compagnia_rapporto`) per risolvere `to`.
2. Genera il PDF in memoria con `buildECAgenziaPdf` (stessa funzione usata da `ECAgenziaPdfPage`), passandogli gli stessi `titoli` già presenti nella riga aggregata (`r.titoli`) filtrati per selezione se presente — esattamente come fa il bottone "Stampa".
3. Converti il `Uint8Array` PDF in base64.
4. Invoca `supabase.functions.invoke("send-email", { body: { to, subject, html, attachments: [{ filename, content }], apply_branding: true } })`.
5. Log in `log_attivita` con `azione = 'invio_ec_agenzia_email'`, dettagli `{ destinatario, compagnia_id, num_titoli, totale_da_rimettere }` — best-effort, non bloccante.

## Testo email di default

**Oggetto**: `Estratto Conto Agenzia — {ragione_sociale} — {periodo|oggi}`

**Body** (plain text, send-email lo wrappa in HTML con branding):

```
Spett.le {ragione_sociale},

in allegato trasmettiamo l'estratto conto relativo ai titoli in attesa di rimessa
{periodo ? `per il periodo ${dal} - ${al}` : `aggiornato al ${oggi}`}.

Totale lordo: € {totale_lordo}
Totale provvigioni: € {totale_provvigioni}
Totale da rimettere: € {totale_da_rimettere}

Restiamo a disposizione per ogni chiarimento.

Cordiali saluti,
Consulbrokers
```

Allegato: `EC_Agenzia_{codice}_{YYYYMMDD}.pdf`.

## File modificati

- `src/pages/contabilita/ECCompagniaContabPage.tsx`
  - Import: `Mail` da `lucide-react`, `buildECAgenziaPdf` da `@/lib/ec-agenzia-pdf`, `supabase`, `toast`.
  - Nuovo handler `handleInviaEmail(r)` con risoluzione destinatario + generazione PDF + invio.
  - Stato locale `sendingEmailId: string | null` per disabilitare il bottone della singola riga in invio.
  - Aggiunta JSX del bottone tra "Stampa E/C" e "Metti in pagamento", visibile solo se `isAgenzia`.

Nessuna modifica a edge functions, DB, o `send-email` (già supporta `attachments` base64).

## Out of scope

- Personalizzazione del testo prima dell'invio (preview/edit). Se la vuoi, la aggiungiamo come passo 2 con un piccolo dialog.
- Template salvato in `template_email`. Per ora testo hard-coded nel componente.
- Invio bulk multi-agenzia.
