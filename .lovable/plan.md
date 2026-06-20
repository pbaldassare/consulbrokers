# Fix "Polizza non trovata" da Carico

## Causa

Network log: `GET /rest/v1/polizze?select=...clienti:cliente_anagrafica_id(...,codice)...` → **400** con `column clienti_1.codice does not exist`. La colonna corretta è `codice_cliente`. La query fallisce e `maybeSingle` ritorna `null`, quindi la pagina mostra "Polizza non trovata".

## Intervento

In `src/pages/PolizzaDetail.tsx` (riga 66) sostituire `codice` con `codice_cliente` nel select embeddato:

```ts
clienti:cliente_anagrafica_id (id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, codice_cliente)
```

Nessun'altra modifica necessaria: l'id è corretto, RLS ok, la polizza esiste.

## File toccati

- `src/pages/PolizzaDetail.tsx`
