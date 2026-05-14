---
name: Auto-generazione quietanza su messa a cassa
description: Trigger DB che crea automaticamente la quietanza successiva alla messa a cassa
type: feature
---
# Generazione automatica quietanza successiva

Trigger `trg_genera_quietanza_su_messa_cassa` (AFTER UPDATE OF stato ON titoli, funzione `public.genera_quietanza_su_messa_cassa`):

- Si attiva quando `stato` passa a `incassato`.
- Skip se **poliennale** (durata > 13 mesi tra `garanzia_da` e `garanzia_a`): la stessa riga resta `attivo`.
- Skip se esiste già un successore (`sostituisce_polizza = NEW.numero_titolo` AND riga match) → evita doppioni con `RinnovoTitoloDialog` pre-staged.
- Calcola periodo dal `frazionamento` testuale (Mensile=1, Trimestrale=3, Quadrimestrale=4, Semestrale=6, Annuale=12); fallback a `12/rate` se mancante.
- Inserisce nuovo `titoli` con `numero_titolo` invariato, `riga = max+1`, stato `attivo`, date traslate (`durata_da = old.durata_a`, `durata_a = +N mesi`), garanzia con stesso offset rispetto a `durata_da`.
- Copia: anagrafica cliente, prodotto, sede, produttore, compagnia/rapporto, ramo, specialist, commerciale (+anagrafica/percentuali), AE, frazionamento/rate/periodicita, tacito_rinnovo, descrizione, valuta, indicizzata.
- Premi: usa i campi `*_quietanza` (fallback ai `*_firma`); inizializza sia firma sia quietanza con gli stessi valori.
- Copia righe `premi_garanzia_polizza` (sia `firma` sia `quietanza`).
- `sostituisce_polizza/sostituisce_riga` = origine.

La nuova quietanza compare automaticamente nel **Carico del Mese** del periodo target (es. annuale 14/05/2026 → quietanza 14/05/2027 in Carico 05/2027).

⚠️ Convenzione: `data_scadenza` della nuova quietanza = **decorrenza** (`garanzia_da`/`durata_da`), NON `garanzia_a`. Il "Carico del Mese" filtra per `data_scadenza` = mese in cui la rata va incassata, quindi deve coincidere col mese di rinnovo.

## Distinzione UI Polizza vs Quietanze

Nel modello una "polizza" utente = catena di record `titoli` con stesso `numero_titolo`:
- **Polizza originale** (madre): `sostituisce_polizza IS NULL`
- **Quietanze / Rate successive**: `sostituisce_polizza` valorizzato (= numero_titolo origine)

Helper condiviso: `src/lib/quietanze.ts` (`groupTitoliByPolizza`, `isQuietanza`, `getRataIndex`, `tipoLabel`).

UI:
- **ClienteDetail → tab Polizze**: tabella raggruppata per `numero_titolo`. La madre è la riga principale (badge "Polizza"); le quietanze sono righe figlie espandibili (chevron) con badge "Rata N" e periodo `garanzia_da → garanzia_a`. Colonna "Rate" mostra `1 + N`.
- **TitoloDetail header**: badge accanto al titolo `Polizza originale` se madre, altrimenti `Quietanza · dal gg/mm/aaaa al gg/mm/aaaa` (tooltip mostra il `sostituisce_polizza`).

