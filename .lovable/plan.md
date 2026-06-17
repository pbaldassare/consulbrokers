
## Gestione Polizze — pagina action-first

Nuova pagina `/portafoglio/gestione`: scegli prima **l'operazione**, poi filtri **cliente/polizza**, esegui. Tutte le azioni riusano gli stessi componenti/dialog/route già presenti in `TitoloDetail` → sincronizzazione automatica con le polizze.

## Layout

```text
┌─ Gestione Polizze ────────────────────────────────────────┐
│ 1. Scegli operazione                                       │
│ ┌──────────┬──────────┬──────────┬──────────┐             │
│ │Appendice │  Storno  │ Rinnovo  │ Duplica  │             │
│ │Sostituz. │Sospension│Riattivaz │Annulla   │             │
│ │Messa Cassa│Annulla MC│Carica Doc│Precontr.│             │
│ └──────────┴──────────┴──────────┴──────────┘             │
├────────────────────────────────────────────────────────────┤
│ 2. Filtra polizza (filtri pre-impostati per operazione)    │
│   [Cliente ▼] [Compagnia ▼] [Ramo ▼] [Stato ▼]            │
│   [N° Polizza] [Scadenza dal—al]                          │
├────────────────────────────────────────────────────────────┤
│ 3. Risultati (paginati 25, debounce 350ms, zebra)         │
│   N°  Cliente  Compagnia  Ramo  Decorr  Scad  Stato [Esegui]│
└────────────────────────────────────────────────────────────┘
```

## 12 operazioni — set completo

| # | Operazione | Filtro stato di default | Come si esegue (riuso) |
|---|---|---|---|
| 1 | Appendice | `attivo` | route `/portafoglio/appendici?titoloId=...` |
| 2 | Storno | `attivo` (no già stornato) | `<StornoDialog>` estratto da TitoloDetail |
| 3 | Rinnovo | `attivo` + scadenza ≤ 90gg | `<RinnovoDialog>` estratto da TitoloDetail |
| 4 | Duplica | tutti | route `/portafoglio/immissione?duplicaDa=<titoloId>` |
| 5 | Sostituzione | `attivo` | `<SostituzioneDialog>` estratto |
| 6 | Sospensione | `attivo` (non sospeso) | `<SospensioneDialog>` estratto |
| 7 | Riattivazione | `sospeso` | `<RiattivazioneDialog>` estratto |
| 8 | Annulla Polizza | tutti tranne `annullato` | `<AnnullaPolizzaDialog>` (admin) |
| 9 | Messa a Cassa | `attivo` & no `data_messa_cassa` | `<MessaACassaDialog>` estratto |
| 10 | Annulla Messa a Cassa | `incassato` o con `data_messa_cassa` | `<AnnullaMessaCassaDialog>` (admin) |
| 11 | Carica Documenti | tutti | `<DocumentiTitoloUploader>` in modal con `titolo_id` |
| 12 | Genera Precontrattuale | tutti | route `/portafoglio/doc-precontrattuale?titoloId=...` |

Permessi: la pagina richiede `hasPermission('titoli')`; ogni dialog mantiene i propri guard (es. admin per Annulla/Annulla MC).

## Duplica — comportamento confermato

`/portafoglio/immissione?duplicaDa=<titoloId>` pre-popola **tutti i campi tecnici** dalla polizza sorgente (cliente, compagnia/rapporto, ramo/sottoramo, frazionamento, garanzie, premi, RCA se presente, …) **lasciando vuoti e obbligatori**:
- **Numero Polizza** (obbligatorio, da inserire a mano)
- **Decorrenza / Scadenza** (obbligatorie)
- **CIG** (se presente nell'originale viene azzerato)

Salvataggio bloccato finché i 3 campi obbligatori non sono valorizzati (validation Zod già esistente in `ImmissionePolizzaPage`). La polizza salvata è un titolo nuovo, indipendente — nessun legame DB con la sorgente (solo log: "Duplicata da N° XXX" in `log_attivita`).

## Sincronizzazione

Nessuna logica duplicata: ogni operazione scrive sulle stesse tabelle (`titoli`, `appendici_polizza`, `titoli_storni`, `titoli_sostituzioni`, `movimenti_polizza`, `documenti`, `log_attivita`) tramite gli stessi componenti già usati in `TitoloDetail`. Risultato visibile automaticamente in:
- scheda polizza (TitoloDetail)
- Polizze Attive / Carico / Storico
- Log Attività (tab dedicato)
- trigger esistenti (auto-quietanza, notifica messa a cassa email, cascade annullamento…)

## File toccati

**Nuovi**
- `src/pages/GestionePolizzePage.tsx` — hub con cards + filtri + tabella
- `src/components/polizze/azioni/StornoDialog.tsx`
- `src/components/polizze/azioni/RinnovoDialog.tsx`
- `src/components/polizze/azioni/SostituzioneDialog.tsx`
- `src/components/polizze/azioni/SospensioneDialog.tsx`
- `src/components/polizze/azioni/RiattivazioneDialog.tsx`
- `src/components/polizze/azioni/AnnullaPolizzaDialog.tsx`
- `src/components/polizze/azioni/MessaACassaDialog.tsx`
- `src/components/polizze/azioni/AnnullaMessaCassaDialog.tsx`
- `src/components/polizze/azioni/CaricaDocumentiDialog.tsx`

(I dialog vengono **estratti** dalla logica inline attualmente in `TitoloDetail.tsx`. Se un'azione è già un componente esterno, si riusa direttamente.)

**Modificati**
- `src/routes/portafoglio.tsx` — nuova route `/portafoglio/gestione`
- `src/components/MainLayout.tsx` (o file sidebar Portafoglio) — voce di menu "Gestione Polizze" sotto Portafoglio
- `src/pages/TitoloDetail.tsx` — usa i dialog estratti (zero cambio di comportamento)
- `src/pages/ImmissionePolizzaPage.tsx` — supporto query param `?duplicaDa=<titoloId>`: prefill campi tecnici, reset N°/date/CIG con validation obbligatoria

**Non toccati**: schema DB, RLS, edge functions, trigger.

## Memory da aggiornare

Aggiungo `mem://features/gestione-polizze-hub` con: "Hub azioni-first in `/portafoglio/gestione`. 12 operazioni che riusano i dialog/route di TitoloDetail. Duplica via `?duplicaDa=` con N°/decorrenza/scadenza obbligatori."
