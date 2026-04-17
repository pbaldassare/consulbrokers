
## Diagnosi

L'utente segnala che il KPI "Polizze in scadenza" del Carico del Mese mostra **14**, ma dopo gli annullamenti messa a cassa dovrebbero essere **16**. Mancano 2 polizze al conteggio.

## Investigazione necessaria

1. **Vista `v_portafoglio_titoli`** — come definisce "Carico del Mese" e con che filtro su `stato`/`data_messa_cassa`/`data_scadenza`
2. **Query KPI** in `src/pages/PortafoglioCaricoPage.tsx` — come calcola il conteggio "Polizze in scadenza" (probabilmente filtra `stato != 'incassato'` o `data_messa_cassa IS NULL`)
3. **Stato reale dei 2 titoli mancanti** — eseguo SELECT su `titoli` per i titoli annullati di recente nel mese aprile 2026 per vedere se:
   - `stato` è davvero `attivo` (non residuo `incassato`)
   - `data_messa_cassa` è `null`
   - La vista `v_portafoglio_titoli` li ricomprende

## Causa probabile

Una di queste:
- **(A)** L'helper `annullaMessaACassa` non resetta tutti i campi che il filtro della vista controlla (es. lascia `data_incasso` o `importo_incassato` valorizzato e la vista esclude le righe con `data_incasso IS NOT NULL`)
- **(B)** La vista `v_portafoglio_titoli` è materializzata e non si è rinfrescata
- **(C)** La query del KPI usa un filtro diverso da quello della tabella sotto (es. KPI conta `stato='attivo'` mentre la tabella mostra anche `stato='sospeso'`/`scaduto`)
- **(D)** React Query cache non invalidata dopo l'annullamento (UI mostra valore stale)

## Fix proposto

1. Allineare la query KPI con la vista (stesso filtro della tabella)
2. Garantire reset completo in `annullaMessaACassa` (già fa stato/data_messa_cassa/importo_incassato — verifico se manca qualcosa che la vista controlla)
3. Aggiungere `queryClient.invalidateQueries` su tutte le key del Carico del Mese (KPI + lista) dopo annullamento singolo e bulk
4. Se vista materializzata: chiamare `REFRESH MATERIALIZED VIEW` o sostituirla con vista normale

### File toccati (stima)
- `src/pages/PortafoglioCaricoPage.tsx` — invalidate queries dopo annullamento + verifica filtro KPI
- `src/lib/annullaMessaACassa.ts` — eventuale aggiunta campi nel reset
- (Eventuale) migration SQL se la vista ha logica errata o è materializzata

### Prima di procedere
Faccio l'investigazione DB (SELECT su `pg_views` per `v_portafoglio_titoli` + SELECT sui titoli annullati) per identificare la causa esatta, poi applico solo il fix necessario senza toccare il resto.
