# AGENTS.md — Decisioni tecniche

- Gli E/C Agenzia archiviati si correggono solo tramite `src/lib/contabilita/rigeneraEcAgenzia.ts`: stesso riferimento/data/righe, ricalcolo provvigioni con `getProvvigioneEC`, nuovo file in storage + aggiornamento `documenti.path_storage` (il bucket non consente update) e log `rigenera_ec_agenzia` — così il numero progressivo non cambia e resta traccia del prima/dopo.
