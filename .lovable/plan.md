## Problema

Nella dashboard cliente (`/cliente`) i KPI in alto mostrano:
- Polizze Attive: **0**
- Premi Totali: **0 €**
- Scadenze 90gg: **0**

Mentre nella pagina `/cliente/polizze` si vedono correttamente 6 polizze reali. Questo perché `ClienteDashboard.tsx` legge solo dalla tabella `titoli`, ma le 6 polizze del Comune di Varese vivono in `polizza_cga` (estratte da PDF).

## Fix

Modificare **solo** `src/pages/cliente/ClienteDashboard.tsx` per replicare il pattern già usato in `ClientePolizze.tsx`:

1. Aggiungere alla `Promise.all` esistente una query su `polizza_cga` filtrata per `cliente_id IN ids` e `stato='approvato'`, in join con `prodotti_cga` per recuperare `nome_prodotto`, `compagnia`, `ramo`.

2. Mappare i record CGA nella stessa shape dei `titoli`:
   - `stato: "attivo"` (così entrano nel filtro `attive`)
   - `premio_lordo: premio_lordo_totale`
   - `data_scadenza`, `durata_da: data_decorrenza`
   - `numero_titolo: numero_polizza`
   - `compagnie: { nome: prodotti_cga.compagnia }`
   - `rami: { descrizione: prodotti_cga.ramo }`

3. Concatenare i due array prima di `setPolizze`, così tutti i counter e i grafici si aggiornano automaticamente:
   - Polizze Attive (count)
   - Premi Totali (somma `premio_lordo`)
   - Scadenze 90gg
   - Ripartizione Premi per Ramo (pie)
   - Premi per Agenzia (bar)
   - Prossime Scadenze (lista)
   - Premi vs Sinistri per Anno (bar, usa `durata_da`)

Nessuna modifica a sinistri, notifiche, layout o styling. Nessuna nuova route/edge function.

## File toccati

- `src/pages/cliente/ClienteDashboard.tsx` — aggiunta query CGA + merge.
