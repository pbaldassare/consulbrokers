---
name: Sospensione polizza — regole
description: Sospensione cancella quietanze future non incassate; rata sospesa resta in Polizze Attive; campi modificabili; limite_riattivazione default +3 mesi
type: feature
---

## Form Sospensione

- `data_sospensione` default = oggi.
- `limite_riattivazione` default = `data_sospensione + 3 mesi`; si auto-aggiorna finché l'utente non lo modifica manualmente.
- `motivo` default precompilato: "Sospensione su richiesta cliente" (modificabile).

## Effetti

- Update `titoli` (solo rata target): `stato='sospeso'`, `data_sospensione`, `limite_riattivazione`, `motivo_sospensione`.
- **Cancellazione quietanze future**: tutte le righe `titoli` con stesso `numero_titolo`, `riga > rata sospesa`, `stato != 'incassato'` e `data_messa_cassa IS NULL` vengono eliminate (con pulizia preventiva di `movimenti_polizza` e `premi_garanzia_polizza` collegati). Le rate già messe a cassa / incassate restano intatte (la sospensione è prospettica).
- Insert `movimenti_polizza` con `tipo_documento='SO'`, `stato='sospeso'`.
- `logAttivita('sospensione_polizza', 'titolo', id, { ..., quietanze_eliminate: [ids] })`.

## UI

- TitoloDetail: `stato='sospeso'` NON entra in `isLocked` → i campi (contratto, periodo, importi, ecc.) restano editabili. Compare la card gialla "Polizza Sospesa" con CTA Riattivazione.
- **Polizze Attive**: la rata sospesa resta visibile (filtro `stato IN (attivo, sospeso)`), con badge "Sospesa" accanto al badge Tipo.
- **Storico Polizze**: NON mostra più le sospese (rimosso `sospeso` dal filtro "tutti" e dal dropdown stato).
- **Carico del Mese**: invariato (le sospese non vi appaiono).

## Riattivazione (da implementare)

Al ripristino dovrà ricalcolare le quietanze (date + importi) dalla rata riattivata fino a scadenza in base al frazionamento, dato che le future erano state cancellate.

## File

- `src/pages/SospensionePolizzaPage.tsx`
- `src/pages/PortafoglioAttivePage.tsx`
- `src/pages/PortafoglioStoricoPage.tsx`
