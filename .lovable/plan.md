## Problemi rilevati

Sulla pagina `/titoli/:id` (file `src/pages/TitoloDetail.tsx`), per i rami **non-auto** (es. "ANIMALI DOMESTICI" del titolo corrente), succedono due cose sbagliate:

### 1. Card duplicate

Vengono renderizzate **due volte** le stesse card Firma + Quietanza:

- **Set A** — dentro la sezione **"Importi"** (`TitoloDetail.tsx` righe 2680 e 2723): `<VociRcaCard tipoPremio="firma" />` + `<VociRcaCard tipoPremio="quietanza" />`, con titolo di default *"Composizione Premio RCA — Firma/Quietanza"* (anche per rami non-RCA → label sbagliata).
- **Set B** — sezione standalone **"Premi per Garanzia"** (righe 3019-3113): le stesse due `VociRcaCard` con `titolo="Premi per Garanzia — Firma/Quietanza"` e `mostraCampiCapitaleRata`.

Entrambi i set puntano a `titoloId={t.id}` e allo stesso `tipo_premio`, quindi leggono e scrivono sulle stesse righe di `premi_garanzia_polizza`. Risultato: due card uguali in pagina + race condition (entrambi gli effetti realtime e gli `onTotaliChange` sparano `update titoli` in parallelo, causando flicker e potenziali sovrascritture).

### 2. Colonna "Voce" mostrata vuota

Verifica DB sul titolo corrente (`4f71899a-…`): le righe esistono con `garanzia="MB"` e `garanzia="Malattia"`, `firma=111` e `firma=120`. Lato UI i valori numerici si vedono correttamente, ma la cella **"Voce"** mostra il placeholder "Nome ga…" → l'input riceve stringa vuota.

Causa: `VociRcaCard.tsx` riga 685 usa `<Input defaultValue={v.garanzia ?? ""} />` (uncontrolled). Con due istanze montate sullo stesso `titoloId`/`tipo_premio` si invalidano a vicenda via realtime (`invalidateBoth` riga 211) e in alcuni cicli di refetch il `key={`gar-${v.id}-${v.garanzia ?? ""}`}` non basta a forzare il rimount in tempo, lasciando il defaultValue al primo valore disponibile (vuoto, durante uno stato intermedio del refetch).

## Fix

### 1. `src/pages/TitoloDetail.tsx` — eliminare il blocco duplicato

Rimuovere completamente la sezione standalone `<SectionCollapsible title="Premi per Garanzia">` (righe **3019-3113**, incluso il wrapping `{!isRamoAuto(...) && (...)}`).

Le due card che restano dentro **Importi** (righe 2680 e 2723) coprono sia il caso auto che non-auto tramite il flag `_isAuto`. Per allinearle al comportamento della sezione rimossa:

- aggiungere `mostraCampiCapitaleRata` quando `_isAuto === false` (parità funzionale con la versione standalone),
- passare `titolo={…}` esplicito così non compare "Composizione Premio RCA" per rami non-RCA. Esempio:
  - Firma: `titolo={_isAuto ? "Composizione Premio RCA — Firma" : `Premi per Garanzia — Firma (${_ramo?.descrizione || "—"})`}`
  - Quietanza: analoga con "Quietanza".

Nessun'altra modifica logica: gli `onTotaliChange` / `onProvvigioniChange` / `onAddizionaliChange` già presenti restano gli unici handler.

### 2. `src/components/polizze/VociRcaCard.tsx` — input "Voce" controllato

Sostituire l'`Input` uncontrolled per la garanzia (righe **683-695**) con una versione **controlled** basata su `draftVoci`:

```tsx
<Input
  value={draftVoci[v.id]?.garanzia ?? v.garanzia ?? ""}
  onChange={(e) => setDraft(v.id, { garanzia: e.target.value } as any)}
  onBlur={(e) => {
    const val = e.target.value.trim();
    clearDraft(v.id, ["garanzia"] as any);
    if (!val || val === v.garanzia) return;
    upsertMut.mutate({ id: v.id, garanzia: val } as any);
  }}
  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
  className="h-8 max-w-[220px]"
  placeholder="Nome garanzia"
/>
```

In questo modo:
- l'input riflette sempre il valore del record dopo qualunque refetch realtime (niente più placeholder fantasma),
- la digitazione utente passa per `draftVoci` (stesso pattern già usato per `firma`, `tasse`, `lordo`), e viene committata sul blur,
- non serve più la `key` artificiale per forzare il rimount.

Aggiungere il supporto a `garanzia` nel tipo di `setDraft/clearDraft` se necessario (l'estensione è `Partial<Voce>`).

## Cosa non cambia

- DB / migration: nessuna modifica.
- Logica di calcolo IPT/SSN, sync Quietanza ↔ Firma, addizionali, provvigioni: invariate.
- Lock messa-a-cassa, banner ambra, pulsanti operazioni: invariati.
- Sezione **Importi** (Valuta, Indicizzata, Rimborso, riepilogo Netto/Tasse/Lordo, ImportPolizzaAiButton): invariata.

## File toccati

- `src/pages/TitoloDetail.tsx` — eliminate righe 3019-3113; aggiunti `titolo` + `mostraCampiCapitaleRata` (per non-auto) alle due `VociRcaCard` dentro Importi.
- `src/components/polizze/VociRcaCard.tsx` — input "Voce" controllato (righe 683-695).
