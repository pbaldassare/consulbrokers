
## Obiettivo

Arricchire la libreria template email con un set completo di modelli professionali pronti all'uso, in italiano formale assicurativo, suddivisi per categorie operative tipiche di un'agenzia. Tutti già collegati al sistema esistente (placeholder `{{...}}`, tabella `template_email`, anteprima con dati reali, invio via Resend).

## Categorie da aggiungere (oltre a Sollecito e Rinnovo già presenti)

1. **Benvenuto** — onboarding cliente, attivazione area riservata
2. **Sinistro** — apertura, aggiornamento, liquidazione, chiusura
3. **Quietanza & Incasso** — conferma pagamento, ricevuta, riepilogo
4. **Documentazione** — invio polizza, appendice, certificato, CGA
5. **Scadenze & Avvisi** — preavviso scadenza (60/30/15 gg), tacito rinnovo
6. **Trattativa & Preventivo** — invio preventivo, sollecito decisione
7. **Comunicazioni Istituzionali** — variazioni anagrafiche, privacy, IVASS
8. **Cortesia** — auguri, ringraziamenti post-incasso, follow-up

## Template proposti (16 nuovi modelli)

### Benvenuto
- **Benvenuto nuovo cliente** — saluto + riepilogo referenti sede
- **Attivazione area riservata** — credenziali + link portale

### Sinistro
- **Apertura sinistro — presa in carico** — n. pratica, perito, prossimi passi
- **Richiesta documentazione integrativa** — elenco documenti mancanti
- **Liquidazione sinistro** — comunicazione importo liquidato
- **Chiusura sinistro** — esito definitivo

### Quietanza & Incasso
- **Conferma incasso premio** — ricevuta polizza incassata
- **Quietanza di pagamento** — documento formale a fronte pagamento

### Documentazione
- **Invio polizza emessa** — allegato contratto + CGA
- **Invio appendice** — variazione contrattuale
- **Invio certificato assicurativo** — RCA/fideiussione

### Scadenze
- **Preavviso scadenza 60 giorni** — warning anticipato non vincolante
- **Preavviso disdetta tacito rinnovo** — termini ex art. legge

### Trattativa
- **Invio preventivo** — preventivo in allegato + validità
- **Sollecito decisione preventivo** — follow-up post-invio

### Cortesia
- **Ringraziamento rinnovo** — post-rinnovo confermato

## Modifiche tecniche

**Migration SQL unica** (`supabase/migrations/<ts>_seed_template_email_extended.sql`):
- `INSERT` di 6 nuove categorie in `template_categorie`
- `INSERT` di 16 template in `template_email` (oggetto + corpo formali, già con placeholder corretti)
- Tutti i corpi usano i placeholder già supportati: `{{cliente_nome}}`, `{{cliente_cognome}}`, `{{azienda_ragione_sociale}}`, `{{polizza_numero}}`, `{{polizza_scadenza}}`, `{{polizza_premio}}`, `{{compagnia_nome}}`, `{{sede_nome}}`, `{{sede_indirizzo}}`, `{{sede_email}}`, `{{sede_telefono}}`, `{{data_oggi}}`
- Idempotenza: `WHERE NOT EXISTS` su `(categoria_id, nome)` per evitare duplicati al rerun

**Nessuna modifica al codice frontend**: la `TemplatePage.tsx` li mostra automaticamente nelle categorie nuove.

## Stile dei testi (esempio)

> **Oggetto:** Comunicazione di apertura sinistro – pratica polizza n. {{polizza_numero}}
>
> Gentile {{cliente_nome}} {{cliente_cognome}},
>
> con la presente Le confermiamo l'avvenuta apertura della pratica relativa al sinistro denunciato in data {{data_oggi}}, riferito alla polizza n. {{polizza_numero}} presso la Compagnia {{compagnia_nome}}.
>
> La pratica è stata regolarmente trasmessa agli uffici competenti e Le verrà comunicato a breve il nominativo del perito incaricato.
>
> Restiamo a Sua disposizione per ogni chiarimento.
>
> Cordiali saluti,
> {{sede_nome}}
> {{sede_indirizzo}} – Tel. {{sede_telefono}}

Tutti i 16 template seguono lo stesso registro: formale, assicurativo, conciso, con saluti istituzionali e firma sede.

## File toccati

**Nuovo:**
- `supabase/migrations/<timestamp>_seed_template_email_extended.sql` — categorie + 16 template

**Non toccati:**
- `src/pages/TemplatePage.tsx` (già supporta tutto)
- `supabase/functions/send-email/index.ts` (già pronto per invii reali)

## Cosa NON cambia

- Schema tabelle `template_categorie` / `template_email`
- Logica placeholder e anteprima
- Permessi RLS
- Helper `sendEmail`

## Note

I template sono **modelli base modificabili** dall'admin in UI. Servono come libreria iniziale e come banco di test per il sistema di invio Resend. Nessun trigger automatico viene collegato in questa iterazione: l'invio resta manuale (utente apre template → preview → invia). I trigger automatici (es. preavviso scadenza 60gg) saranno una iterazione successiva, su richiesta esplicita.
