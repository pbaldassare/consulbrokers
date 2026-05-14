## Isolamento quietanze (rate) — implementato

### File modificati
- `src/pages/TitoloDetail.tsx`
  - Helper `assertSameTitolo(id, titoloId, ctx)` aggiunto: throw se discrepanza tra id route e titolo caricato.
  - Chiamato in: `saveCommMutation`, `saveRegMutation`, `saveContrattoMutation`, `savePeriodoMutation`, `saveImportiMutation`.
  - Sync **Firma → Quietanza** in `saveImportiMutation` ora disattivata se `isQuietanza(t)` (sulla rata i campi firma sono storico, non vanno propagati).
  - Nuova query `["catena-titoli", numero_titolo]` carica tutti i record con stesso numero per costruire la catena.
  - Banner "scope" sky sotto l'header quando catena > 1: testo dedicato per madre vs rata, con link "Vai alla polizza madre".
  - Pannello collapsible "Quietanze di questa polizza": tabella di tutte le rate, evidenzia la corrente, click apre `/titoli/:id`.

- `mem://insurance/quietanza-isolation` — nuovo memo con regole di isolamento.
- `mem://index.md` — riferimento aggiunto.

### Verifiche fatte
- Tutte le mutation `titoli` usano `.eq("id", id!)` (audit completo via ripgrep).
- `premi_garanzia_polizza` scoped per `titolo_id` + `tipo_premio`.
- Nessun trigger DB propaga modifiche tra rate (verificato `pg_trigger`).
