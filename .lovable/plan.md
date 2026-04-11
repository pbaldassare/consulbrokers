

## Piano: Segnalazione trattativa gia esistente per evitare doppioni

### Problema
Quando l'utente clicca "Crea Trattativa" su un bando, non c'e' nessun controllo se esiste gia una trattativa collegata a quel bando (via `bandi_trattative`) o una trattativa con lo stesso prospect+prodotto. Si rischiano doppioni.

### Soluzione
Nella funzione `openCreaTrattativaDialog`, prima di aprire il dialog, controllare:

1. **Trattativa gia collegata al bando**: query `bandi_trattative` per `bando_id` con join a `trattative` per ottenere stato e prodotto
2. **Trattativa esistente per lo stesso prospect+prodotto**: query `trattative` dove `prospect_id` = prospect dell'ente e `prodotto` simile

Se trovata, mostrare un **avviso visibile nel dialog** (banner giallo/arancione) con i dettagli della trattativa esistente (stato, data, prodotto). L'utente puo' comunque procedere se vuole, ma e' avvisato.

Inoltre, il badge "N trattative" gia presente sulla card bando serve come indicatore visivo immediato.

### Modifiche

| File | Azione |
|------|--------|
| `src/pages/BandiPubbliciPage.tsx` | In `openCreaTrattativaDialog`: query per trattative esistenti collegate al bando. Mostrare banner di avviso nel dialog con dettagli. Anche nel popup di conferma segnalare il doppione. |

### Dettagli tecnici
- Query: `supabase.from("bandi_trattative").select("trattativa_id, trattative(id, prodotto, stato, data_apertura, premio_previsto)").eq("bando_id", bando.id)`
- Se risultati > 0: stato `existingTrattative` con array, mostrato come alert nel dialog
- L'utente puo' comunque creare (non bloccante), ma il warning e' chiaro

