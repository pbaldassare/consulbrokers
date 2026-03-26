

## Piano: Simulazione Sinistri Realistici con Dati Completi

### Cosa si costruisce

1. **Migration SQL** per estendere la tabella `sinistri` con campi finanziari e operativi mancanti, poi inserire dati demo realistici collegati a clienti e polizze esistenti
2. **Tab "Sinistri" nel ClienteDetail** per visualizzare i sinistri collegati alle polizze del cliente
3. **Pagina ClienteSinistri** nel portale cliente per visualizzare i propri sinistri

### Interventi

**1. Migration: nuovi campi sulla tabella `sinistri`**

Aggiungere colonne che mancano per una gestione realistica:
- `tipo_sinistro` (text): incidente_stradale, furto, incendio, danni_acqua, RC_terzi, infortunio, grandine, ecc.
- `luogo_sinistro` (text)
- `data_evento` (date)
- `costo_preventivato` (numeric)
- `costo_effettivo` (numeric)
- `franchigia` (numeric)
- `importo_liquidato` (numeric)
- `importo_riserva` (numeric)
- `targa_veicolo` (text)
- `controparte` (text)
- `note_perito` (text)
- `numero_sinistro_compagnia` (text)
- `cliente_anagrafica_id` (uuid FK → clienti) per collegamento diretto al CRM

**2. Migration: seed dati sinistri realistici**

Inserire ~15-20 sinistri distribuiti tra i clienti con polizze esistenti, con:
- Stati misti (aperto, in_lavorazione, chiuso, respinto)
- Costi preventivati vs effettivi realistici
- Checklist ed eventi collegati
- Collegamento a `titolo_id` (polizze reali) e `cliente_anagrafica_id`

**3. ClienteDetail: aggiungere tab "Sinistri"**

Nel file `src/pages/ClienteDetail.tsx`:
- Nuova tab "Sinistri" nella TabsList con conteggio
- Query sinistri filtrata per `cliente_anagrafica_id` = cliente corrente
- Tabella con: N. Sinistro, Tipo, Polizza, Stato, Costo Prev., Costo Eff., Data Apertura
- Click naviga a `/sinistri/:id`

**4. Portale Cliente: pagina sinistri**

- Nuovo file `src/pages/cliente/ClienteSinistri.tsx` con lista sinistri propri
- Aggiunta route `/cliente/sinistri` in `src/routes/cliente.tsx`
- Link nella dashboard cliente

**5. Aggiornare SinistroDetail**

Mostrare i nuovi campi (costi, luogo, tipo, controparte, targa) nelle card informative

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File creati | 1 migration SQL, `ClienteSinistri.tsx` |
| File modificati | `ClienteDetail.tsx`, `SinistroDetail.tsx`, `SinistriList.tsx`, `cliente.tsx` routes, `gestione-sinistri/index.ts`, `types.ts` |
| Dati seed | ~15-20 sinistri con checklist ed eventi, collegati a titoli e clienti esistenti |
| Campi finanziari | costo_preventivato, costo_effettivo, franchigia, importo_liquidato, importo_riserva |

