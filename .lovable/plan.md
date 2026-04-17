
## Richiesta

Quando si **annulla la Messa a Cassa** di un titolo, il contatore "Polizze in scadenza" del Carico del Mese deve aggiornarsi correttamente (riportare il titolo tra quelle in scadenza, non più incassate).

## Diagnosi

Devo verificare:
1. Come funziona l'annullamento della messa a cassa — quale flow esegue (edge function o update diretto), quali campi resetta su `titoli` (`stato`, `data_messa_cassa`, `importo_incassato`, ecc.)
2. Come la vista `v_portafoglio_titoli` / Carico del Mese filtra le "polizze in scadenza" — probabilmente per `stato != 'incassato'` e `data_scadenza` nel mese
3. Se l'annullamento lascia residui (es. `movimenti_contabili`, `data_messa_cassa` non azzerata) che falsano il conteggio

### File/oggetti da ispezionare
- `src/pages/TitoloDetail.tsx` — handler "Annulla messa a cassa"
- Eventuale edge function `messa-a-cassa` / `gestione-titolo`
- Definizione vista `v_portafoglio_titoli` (via `supabase--read_query` su `pg_views`)
- KPI "Polizze in scadenza" sul `PortafoglioCaricoPage.tsx`

## Fix probabile

L'annullamento deve resettare **tutti** i campi tocca dalla messa a cassa:
- `stato` → `attivo`
- `data_messa_cassa` → `null`
- `importo_incassato` → `null` (o 0)
- Eliminare il `movimento_contabile` di incasso collegato
- Eliminare le provvigioni calcolate (se presenti)
- Log attività di annullamento

Se il problema è solo nella UI (cache React Query non invalidata), aggiungo `queryClient.invalidateQueries` sulle key del portafoglio dopo l'annullamento.

### File toccati (stima)
- `src/pages/TitoloDetail.tsx` — handler annullamento: completo reset campi + invalidazione query
- (Eventuale) edge function dedicata se l'operazione è complessa
- (Eventuale) migration se la vista `v_portafoglio_titoli` ha logica errata

### Domanda bloccante

Quando si annulla la messa a cassa, vuoi che vengano eliminati anche:
1. **Movimenti contabili** di incasso collegati al titolo? (consigliato: sì, altrimenti la cassa resta sfalsata)
2. **Provvigioni calcolate** automaticamente all'incasso? (consigliato: sì, vanno ricalcolate al prossimo incasso)
3. **Pagamenti provvigioni** già emessi che includono questo titolo? (consigliato: **bloccare l'annullamento** se il titolo è già in una distinta di pagamento, per evitare incongruenze contabili)

Confermi 1+2+3 (reset completo con blocco se già pagato) o preferisci solo reset stato/data senza toccare contabilità/provvigioni?
