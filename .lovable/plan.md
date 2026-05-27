## Obiettivo

Migliorare l'import AI delle polizze (PDF) — oggi sbaglia due cose sulla scheda Generali RCA Auto del Comune di Agnone:

1. **Sottorami non mappati** (Grandine, Cristalli, ecc.) → arrivano senza `codice_sottoramo`, l'utente deve sceglierli a mano riga per riga.
2. **Dati veicolo non estratti** quando la polizza è RCA Auto (Targa, Telaio, Marca/Modello, CV/KW, classe BM, uso, immatricolazione, ecc.) → la sezione "RCA AUTO" si apre vuota.

Inoltre il popup di riepilogo finale mostra solo 8 righe + tabella garanzie: vogliamo mostrare **molto di più** (dati veicolo, conducente, periodo completo, compagnia/agenzia matchata) sulla scia del popup provvigioni.

## Cosa cambia

### 1. Edge function `parse-polizza-completa` — estrazione veicolo + matching sottorami "fuzzy"

**a) Aggiungere al TOOL Gemini un blocco `veicolo`** (popolato SOLO se la polizza è RCA Auto / gruppo ZQ):

```text
veicolo: {
  targa, telaio, marca, modello, versione, descrizione,
  tipo_veicolo (AUTOVETTURA, MOTOCICLO, AUTOCARRO, …),
  uso_codice (es. USO PRIVATO / TRASPORTO COSE PROPRIO),
  data_immatricolazione (YYYY-MM-DD),
  anno_acquisto,
  provincia_circolazione (sigla 2 lettere),
  classe_bm (1–18),
  cv, kw, cc, posti,
  peso_motrice, peso_rimorchio, peso_totale,
  alimentazione (BENZINA/DIESEL/GPL/METANO/ELETTRICA/IBRIDA),
  tipologia_guida
}
conducente: { nome, cognome, codice_fiscale, indirizzo, cap, citta, provincia,
              data_nascita, tipo_patente, data_rilascio_patente }
```

**b) Prompt più ricco** quando `gruppo_ramo.codice === "ZQ"`: istruzioni esplicite a leggere la sezione "Dati veicolo" / "Identificativi veicolo" / "Conducente abituale" tipica delle schede italiane, formati data, classe Bonus/Malus.

**c) Matching sottorami fuzzy lato server (potenziamento dell'attuale heuristic fallback)**:
- Allargare l'attuale tabella regex a sinonimi reali delle compagnie: Generali, Allianz, AmTrust, ecc.
- Per ZQ aggiungere chiavi: `eventi naturali|forza maggiore`, `atti vandalici|terzi|ricorso|sociopolit`, `bagagli`, `infortuni conducente`, `assistenza|soccorso stradale`, `tutela legale`, `cristalli|vetri`, `kasko|garanzia danni|collisione`, `furto|incendio|rapina`, `auto rischi diversi|A.R.D.|ARD`.
- Per OGNI ramo (non solo ZQ): se l'AI restituisce `codice_sottoramo` non presente in `sottorami_ammessi`, **scartarlo** invece di tenerlo errato, poi tentare match fuzzy (Levenshtein o token-overlap) tra `descrizione` voce ↔ `descrizione` dei sottorami ammessi → assegnare se score ≥ soglia.
- Restituire anche un flag `match_confidence` per voce ("alta" / "media" / "manuale") per mostrarlo nel popup.

### 2. UI `ImportNuovaPolizzaAIDialog.tsx` — applicare veicolo/conducente + popup riepilogo esteso

**a) Tipo `ParsedPolizzaData`**: aggiungere `veicolo?: { … }` e `conducente?: { … }` come da TOOL.

**b) Passare i nuovi campi al form**: nel callback `onApply` (già gestito da `handleAIImportApply` in `ImmissionePolizzaPage.tsx`) aggiungere — solo se `isRCA` — i `setVMarca`, `setVModello`, `setVTarga`, `setVTelaio`, `setVTipoVeicolo`, `setVUso`, `setVDataImmatricolazione`, `setVClasseBm`, `setVCv`, `setVKw`, `setVCc`, `setVPosti`, `setVProvinciaCircolazione`, `setVTipoAlimentazione`, e i campi `c*` del conducente.

**c) Auto-attivazione modello auto**: se `polizzaAuto` flag è già attivo OPPURE il `gruppoRamo` scelto è ZQ, l'AI **deve** estrarre anche `veicolo` (oggi la sezione si apre vuota perché non riceve nulla). Se `polizzaAuto === false` ma `parsed.veicolo` arriva con almeno targa/telaio → forzare `setPolizzaAuto(true)` per aprire la sezione RCA Auto come l'utente si aspetta.

**d) Popup riepilogo (`step === "summary"`) esteso**, layout in 3 sezioni come il popup provvigioni:

```text
┌─ Anagrafica polizza ───────────────────────────────┐
│ Numero, Compagnia (gruppo + agenzia matchata),     │
│ Contraente + CF/PIVA, indirizzo completo           │
└────────────────────────────────────────────────────┘
┌─ Periodo & Premi ──────────────────────────────────┐
│ Decorrenza→Scadenza, Frazionamento, Tacito rinn.,  │
│ Premio firma (netto/accessori/imposte/lordo),      │
│ Premio quietanza (idem)                            │
└────────────────────────────────────────────────────┘
┌─ Veicolo (solo se RCA) ────────────────────────────┐
│ Targa, Telaio, Marca/Modello, Tipo, Uso,           │
│ Immatricolazione, CV/KW/CC, Posti, Prov., BM,      │
│ Alimentazione                                      │
└────────────────────────────────────────────────────┘
┌─ Conducente (solo se RCA) ─────────────────────────┐
│ Nome, CF, Data nascita, Patente + data rilascio    │
└────────────────────────────────────────────────────┘
┌─ Garanzie estratte ────────────────────────────────┐
│ Descrizione | Sottoramo (badge codice + nome)      │
│  | Confidence (alta/media/manuale) | Netto | Imp.  │
└────────────────────────────────────────────────────┘
```

Badge ambra "—" quando il sottoramo non è stato matchato e va scelto manualmente nel form.

### 3. Note tecniche

- Modello AI invariato (`google/gemini-2.5-flash`) — basta arricchire schema/prompt.
- Nessuna modifica DB.
- I `set*` veicolo esistono già in `ImmissionePolizzaPage.tsx` (linee 268-313).
- L'`useEffect([isRCA])` di reset rimane: i dati veicolo vengono scritti DOPO che il flag/ramo sono settati, quindi non vengono azzerati.
- Bump `public/version.json`.

### File toccati

- `supabase/functions/parse-polizza-completa/index.ts` — TOOL schema + prompt + matching fuzzy
- `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx` — tipo `ParsedPolizzaData`, popup summary esteso
- `src/pages/ImmissionePolizzaPage.tsx` — `handleAIImportApply` applica veicolo/conducente + forza `polizzaAuto`
- `public/version.json`

### Fuori scope (per non gonfiare)

- Apprendimento sinonimi persistito su DB (oggi è hardcoded nell'edge function).
- OCR avanzato/PDF multipagina (Gemini gestisce già il PDF intero).
- Edit inline dei dati nel popup: i dati si correggono nel form, come ora.
