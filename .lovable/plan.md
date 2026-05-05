# Import AI polizza RCA: drag & drop → anteprima → validazione → carica nelle voci Firma

L'utente trascina una polizza (PDF/immagine), un'AI estrae le garanzie con i premi, l'app le mappa SOLO sul catalogo `rca_garanzie` esistente, mostra un'anteprima editabile e poi le inserisce nella card "Firma" (la Quietanza si auto-sincronizza tramite il trigger DB già attivo).

## 1. Nuova Edge Function `parse-polizza-rca`

File: `supabase/functions/parse-polizza-rca/index.ts`

- Input POST: `{ fileBase64: string, mimeType: string }` (PDF o immagine).
- Usa **Lovable AI Gateway** (`LOVABLE_API_KEY`, modello `google/gemini-2.5-flash`) con structured output via tool calling.
- Schema di estrazione (solo campi che mappano sul DB):
  ```
  {
    numero_polizza?: string,
    compagnia?: string,
    contraente?: string,
    targa?: string,
    decorrenza?: string,            // YYYY-MM-DD
    scadenza?: string,
    voci_garanzia: [{
      descrizione: string,          // testo originale dalla polizza
      codice_polizza?: string,      // se esplicito sul documento (es. "RCA", "Casko", "08")
      premio_netto: number,
      aliquota_tasse_pct?: number,  // se ricavabile (default 13.5 per non-RCA)
      premio_lordo?: number
    }]
  }
  ```
- Restituisce il JSON così com'è (la mappatura sul catalogo avviene client-side).
- CORS standard, gestione 429/402, no JWT verify.

## 2. Mappatura catalogo client-side (`src/lib/mapGaranzieRca.ts`)

Nuovo modulo puro:

- Carica `rca_garanzie` (codice, descrizione) — già fatto in `VociRcaCard.tsx`.
- Costruisce indice di sinonimi statici **basato 1:1 sul catalogo reale** (i 17 codici esistenti):
  - `RCA` → riga `is_rca_principale` (codice speciale `RCA`, descrizione "RCA Auto").
  - `01` Cristalli → ["cristall"]
  - `02` ARD Terremoto → ["terremot"]
  - `03` ARD Alluvione/Inondazione → ["alluvion", "inondaz", "ard alluvion"]
  - `04` ARD Eventi socio-politici → ["socio", "politic", "atti vandali", "vandalismo"]
  - `05` ARD Incendio autovetture → ["incendio"]
  - `06` ARD Eventi atmosferici → ["atmosferic"]
  - `07` Grandine → ["grandine"]
  - `08` Garanzie accessorie RCA → ["accessor", "garanzie accessorie rca"]
  - `09` ARD Garanzie accessorie → ["ard accessor", "ard garanzie"]
  - `10` Spese recupero unibox → ["unibox", "recupero"]
  - `11` ARD Furto autovetture → ["furto"]
  - `12` PAS Assistenza auto → ["assistenza", "soccorso", "pas"]
  - `13` Tutela giudiziaria → ["tutela", "giudiziar", "legale"]
  - `14` Infortuni → ["infortun"]
  - `15` Casko / Collisione → ["casko", "kasko", "collision"]
  - `90` Diritti → ["diritti"]
  - `91` CANONE BLACK BOX → ["black box", "blackbox", "scatola nera", "canone"]
- Funzione `match(testoEstratto, codiceEsplicito?, catalogo)`:
  - Se `codiceEsplicito` matcha esattamente un `codice` del catalogo → match diretto.
  - Altrimenti normalizza il testo (lower, no accenti) e cerca match per inclusione di una keyword.
  - Ritorna `{ status: "matched" | "ambiguous" | "unmatched", codice?: string, suggerimenti: { codice, descrizione, score }[] }` con i top-3 suggerimenti dal catalogo.
- **Mai inventare codici**: se `unmatched`, la riga viene mostrata in arancione e l'utente sceglie da una `<Select>` che lista esclusivamente i codici esistenti (più "Ignora questa voce").

## 3. Nuovo componente `ImportPolizzaAiButton.tsx`

File: `src/components/polizze/ImportPolizzaAiButton.tsx`

- Bottone "Importa da PDF (AI)" (icona `Sparkles`) reso accanto al titolo della card RCA Firma.
- Click → apre un `Dialog` shadcn con due fasi:
  1. **Drop zone** (`react-dropzone` già in dipendenze, oppure handler nativo `onDrop`/`onDragOver`): accetta PDF + immagini, max 15MB. Loader mentre l'edge function gira.
  2. **Anteprima** (tabella):
     - Colonne: `Testo dalla polizza` · `Codice polizza` · `Mapping suggerito` (Select limitata al catalogo, valore precompilato dal best-match) · `Netto €` · `Aliq. tasse %` · `Lordo €` (calcolato readonly) · `Includi` (Switch).
     - Riga RCA principale evidenziata teal.
     - Righe non mappate evidenziate in arancione con badge "Da mappare".
     - Footer con Totali (somma netto/tasse/lordo) e bottone **"Carica nelle voci Firma"** (disabilitato se restano voci selezionate non mappate).
- Submit:
  - Per ogni riga inclusa con codice mappato:
    - Se è la riga RCA principale e già esiste sul titolo → `update` (premio_netto + aliquota_tasse_pct).
    - Altrimenti → `insert` su `premi_garanzia_polizza` con `tipo_premio='firma'` (la Quietanza specchio è creata dal trigger esistente `sync_quietanza_da_firma`).
  - Toast + invalidazione `["voci-rca", titoloId, "firma"|"quietanza"]` + chiusura dialog.
- **Sempre editabili**: l'utente può modificare in anteprima e ulteriormente dopo il caricamento direttamente nella card (già supportato da `VociRcaCard`).

## 4. Integrazione in `TitoloDetail.tsx`

Sopra la `<VociRcaCard tipoPremio="firma">` (solo per RCA Auto), aggiungere:
```tsx
<div className="flex justify-end">
  <ImportPolizzaAiButton
    titoloId={t.id}
    onImported={() => queryClient.invalidateQueries({ queryKey: ["voci-rca", t.id, "firma"] })}
  />
</div>
```

## 5. Nessun cambio DB

Il catalogo `rca_garanzie` e la tabella `premi_garanzia_polizza` esistono già; il trigger Firma→Quietanza è attivo. Nessuna nuova migrazione.

## File toccati

- **Nuovo**: `supabase/functions/parse-polizza-rca/index.ts`
- **Nuovo**: `src/lib/mapGaranzieRca.ts` (mappatura + sinonimi limitati al catalogo reale)
- **Nuovo**: `src/components/polizze/ImportPolizzaAiButton.tsx`
- **Modifica**: `src/pages/TitoloDetail.tsx` — bottone sopra la card Firma RCA

## Vincoli rispettati

- Solo componenti realmente presenti nel catalogo `rca_garanzie` (17 codici reali letti dal DB ora).
- Nessun campo inventato: l'AI estrae testo libero, ma il match avviene solo contro il catalogo; voci non mappabili devono essere risolte dall'utente con una Select limitata al catalogo o ignorate.
- L'utente può sempre modificare valori in anteprima e poi nella card.
- La Quietanza non viene toccata dall'import: si aggiorna automaticamente via trigger DB esistente.
