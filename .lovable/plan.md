

## Piano: Pagina "Provvigioni Maturate" + ordinamento per data messa a cassa

### Flusso logico
1. Polizza viene messa a cassa → genera provvigioni in `provvigioni_generate`
2. **Provvigioni Maturate** (nuova pagina) → mostra tutte le provvigioni non pagate (`pagata = false`), raggruppate per utente, ordinate per data messa a cassa del titolo
3. Da qui si procede al **Pagamento Provvigioni** (pagina esistente) per creare la distinta di pagamento

### 1. Nuova pagina `ProvvigioniMaturatePage.tsx`
- Query su `provvigioni_generate` con `pagata = false`, join su `titoli` (per `data_messa_cassa`, `numero_titolo`, `premio_lordo`) e `profiles` (per nome commerciale)
- Ordinamento per `titoli.data_messa_cassa` ascendente (le più vecchie prima)
- KPI in alto: Totale maturato, N. provvigioni, N. utenti coinvolti
- Selettore mese (come in Provvigioni Consul)
- Tabella con colonne: Polizza, Compagnia, Ramo, Premio, Data Messa a Cassa, Destinatario, Importo Provvigione, Stato
- Pulsante "Vai a Pagamento" che porta a `/pagamenti-provvigioni`

### 2. Route e sidebar
- Route: `/provvigioni-maturate` in `src/routes/portafoglio.tsx`
- Sidebar: aggiungere "Provvigioni Maturate" nel gruppo Provvigioni in `AppSidebar.tsx`, tra "Provvigioni Consul" e "Pagamenti Provvigioni"

### 3. File coinvolti
- **Nuovo**: `src/pages/ProvvigioniMaturatePage.tsx`
- **Modifica**: `src/routes/portafoglio.tsx` — aggiunta route
- **Modifica**: `src/components/AppSidebar.tsx` — aggiunta voce sidebar

