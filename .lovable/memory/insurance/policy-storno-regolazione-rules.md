---
name: Storno e Regolazione Premio
description: Logica e UI per pulsanti Storno (annullo amministrativo) e Regolazione Premio (conguaglio fine periodo) sul TitoloDetail
type: feature
---

## Storno (`StornoTitoloDialog`)
- Disabilitato se stato in `stornato/estinto/sostituito/annullato`.
- Aggiorna titolo originale → `stato='stornato'`, `data_storno`, `causale_storno`, `motivo_storno`.
- Cancella sempre le quietanze future non incassate (stesso pattern di Estinzione: delete in `movimenti_polizza`, `premi_garanzia_polizza`, `titoli`).
- Se il titolo era **già a cassa** (`data_messa_cassa` o stato `incassato`): crea un **titolo speculare negativo** (premio/netto/provvigioni/accessori/tasse invertiti) in stato `attivo` **da_incassare** — verrà incassato in remittance, non subito. Salvato in `titoli.titolo_storno_id`.
- Documento opzionale nel bucket `documenti_titoli`.
- Snapshot in `titoli_storni` (causale, motivo, importo_rimborsato, era_messa_cassa, documento_id).
- Movimento `ST` in `movimenti_polizza`.

## Regolazione Premio (`RegolazionePremioDialog`)
- Disabilitato se `titoli.regolazione !== true` (flag anagrafico della polizza nella sezione "Regolazione").
- Inserimento manuale di periodo, imponibile, premio lordo/netto/accessori/tasse/provvigioni (positivo = a debito cliente, negativo = a credito).
- Crea **nuovo titolo `RG`** sulla polizza (stessa `numero_titolo`, nuova `riga`), eredita split commerciali, stato `attivo`, `da_incassare`.
- Le quietanze future NON vengono toccate.
- Documento opzionale (lettera compagnia) caricabile subito o dopo da Appendici.
- Snapshot in `titoli_regolazioni`.
- Movimento `RG` sul titolo madre.

## Note
- Niente calcolo automatico di rateo (regola progetto: importi sempre a mano).
- `isLocked` in TitoloDetail già copre `stornato` (campi non editabili).
- Pagina/route legacy `/portafoglio/storno` + `StornoPolizzaPage.tsx` rimosse.
