## Obiettivo

In **Immissione Polizza** rendere il **Gruppo Finanziario** un dato sempre visibile e governante:
- per **cliente esistente** → mostrato come badge derivato dal cliente
- per **nuovo cliente** (creazione inline) → selezione obbligatoria **come primo campo**, prima di tutto il resto, perché determina quali campi anagrafica e quali campi polizza sono obbligatori (privato / azienda / ente).

## Piano

### 1. Nuovo cliente — Gruppo Finanziario come primo step
Nel form "Nuovo cliente" inline della pagina Immissione:
- Aggiungere come **primo campo in cima** un `SearchableSelect` "Gruppo Finanziario *" che lista `gruppi_finanziari` (codice — nome — tipo_soggetto).
- Finché non è selezionato, gli altri campi anagrafica restano disabilitati con messaggio "Seleziona prima il Gruppo Finanziario".
- Una volta scelto, il `tipo_soggetto` derivato pilota:
  - `privato` → mostra Nome, Cognome, CF, data nascita; nasconde Ragione sociale / P.IVA
  - `azienda` → mostra Ragione sociale, P.IVA, CF aziendale; nasconde Nome/Cognome/data nascita
  - `ente` → come azienda + abilita campi gara (CIG/CUP) nella sezione polizza

### 2. Cliente esistente — Badge Gruppo Finanziario
Sotto il SearchableSelect cliente nella sezione "Cliente & Sede":
- Badge colorato con `tipo_soggetto` (🟦 Privato / 🟧 Azienda / 🟩 Ente) + nome del gruppo.
- Se cliente senza `gruppo_finanziario_id` → badge rosso "⚠ Gruppo finanziario mancante" + link "Apri scheda cliente" per assegnarlo.

### 3. Validazione condizionale in Immissione Polizza
Dal `tipo_soggetto` (cliente esistente o appena creato):
- `ente` → CIG e descrizione gara obbligatori; CUP opzionale ma visibile
- `azienda` / `privato` → CIG nascosto
- Asterisco rosso `*` + tooltip "Obbligatorio per {tipoSoggetto}"

### 4. Blocco salvataggio
Bottone "Salva polizza" disabilitato finché:
- gruppo finanziario presente (su cliente esistente o nuovo)
- campi obbligatori condizionali compilati

### Sezione tecnica
- File: `src/pages/ImmissionePolizzaPage.tsx` (estendere query cliente con join `gruppi_finanziari`, riordinare form nuovo cliente, aggiungere logica `tipoSoggetto`).
- Nuovo componente piccolo `GruppoFinanziarioBadge.tsx` in `src/components/polizze/`.
- Stessa logica già usata in `ImportNuovaPolizzaAIDialog.tsx` (rif. righe 421/632) → riusare il mapping.
- Nessuna modifica DB / RLS / edge functions.
- Memoria: `mem://insurance/gruppi-finanziari-tipo-soggetto`.

### Fuori scope
- Modifiche al wizard "Importa da PDF (AI)".
- Refactor della scheda anagrafica cliente completa.
- Validazioni server-side aggiuntive.

Confermi e procedo?