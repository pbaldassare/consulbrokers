# Rimuovi filtro "Modalità Incasso" da E/C Agenzie

File: `src/pages/contabilita/ECCompagniaContabPage.tsx`

- Rimuovo il `FilterSearchableSelect` "Tutte le modalità" (riga 395).
- Rimuovo il campo `modalita_incasso` dall'interfaccia `Filters` e dal `defaultFilters`.
- Rimuovo i filtri logici alle righe 200-202 e dal check `hasFilters` (riga 336).

Lascio invariata la colonna "Modalità Incasso" nella tabella di dettaglio espansa (riga 485) — è solo informativa e l'utente ha chiesto di togliere il filtro, non la colonna. Confermi o tolgo anche quella?
