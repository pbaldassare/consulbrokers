## Fix crash TimelineTab — `Cannot read properties of null (reading 'old')`

**Causa**: in `src/components/TimelineTab.tsx` linea 255, l'iterazione `Object.entries(changes).map(([field, ch]) => …)` accede a `ch.old` / `ch.new` senza verificare che `ch` sia non-null. Alcuni record di audit hanno entry tipo `{ "campo": null }` (es. eliminazioni o snapshot parziali), causando il crash dell'intera pagina cliente.

### Modifica

1. In `extractChanges` (riga 50-55): filtrare le entry con valore null/non-oggetto prima di restituire.
2. In `Object.entries(changes).map` (riga 252): doppia guardia, saltare entry dove `ch == null`, e leggere `ch?.old` / `ch?.new`.

Nessun'altra modifica. Solo difesa difensiva sul rendering del log attività.
