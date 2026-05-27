# Miglioramento sezioni Dati Veicolo e Dati Conducente (RCA)

Obiettivo: armonizzare grafica + spacing con il resto della pagina, ridurre input manuali, sfruttare AI + Google Maps + lookup esistenti per pre-compilare automaticamente.

## 1. Armonizzazione grafica e layout

Adottare lo stesso pattern visuale già usato dalle sezioni superiori (Cliente / Polizza / Importi):

- Grid uniforme: passare da `grid-cols-2 md:grid-cols-4 gap-3` (mescolato con righe a 3, 7, 2, 4) a una griglia coerente `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3` con sub-gruppi logici separati da sottotitoli (`<SectionSubheader>` riutilizzabile: testo `text-[11px] uppercase tracking-wider text-muted-foreground` + linea sottile).
- Sub-gruppi proposti per "Dati Veicolo":
  1. Identificazione (Tipo, Marca, Modello, Versione, Targa, Telaio, Descrizione)
  2. Circolazione (Provincia, Uso, Classe B/M, Immatricolazione, Anno acquisto)
  3. Caratteristiche tecniche (CV, KW, CC, Posti, Pesi, Alimentazione, Guida)
  4. Coperture (Massimali 1/2/3, Franchigia, flags Peius/Temporanea/…)
- Spacing verticale: avvolgere ogni sub-gruppo in `space-y-3` e separare con `pt-3 border-t border-border/40` come nelle altre sezioni.
- Sostituire `Label className="text-xs"` con il componente `FieldLabel` (se esiste già) o uniformare a `text-[11px] font-medium text-foreground/80`.
- Tutti gli `Input` a `h-9` (oggi `h-8`) per coerenza con la sezione "Polizza" sopra, font `text-sm` per i campi testuali e `font-mono` solo per targa/telaio/numerici.
- Flags: spostarli in una riga compatta con `ToggleGroup` o `Checkbox` dentro un blocco `rounded-md border bg-muted/30 p-3` (come fa la sezione importi con i flags).
- Banner "Sezione RCA Auto": ridurre da `py-3` a `py-2.5`, allineare colori a `bg-primary/8` per matchare il teal del progetto.

## 2. Automazioni nel form (input manuali → auto)

| Campo | Oggi | Proposta |
|---|---|---|
| Indirizzo conducente | Input libero | `AddressAutocomplete` (Google Maps, già in repo) → autopopola CAP, Città, Provincia |
| Provincia circolazione | Input libero 2 lettere | `SearchableSelect` con elenco province IT; default = provincia residenza conducente; warning visivo se differisce |
| Provincia conducente | Input libero | Auto da AddressAutocomplete (readonly con override) |
| CAP / Città conducente | Input libero | Auto da AddressAutocomplete |
| Targa | Uppercase on change | + validazione formato IT (regex `^[A-Z]{2}\d{3}[A-Z]{2}$` o moto) con badge inline OK/⚠ |
| Telaio (VIN) | Input libero | Validazione lunghezza 17 + uppercase + bottone "Decodifica VIN" via NHTSA (già documentato in memory `rca-auto-specific-data`) per auto-compilare Marca/Modello/Anno/Alimentazione/CV/KW/CC/Posti |
| Marca / Modello | Combobox | Se decodifica VIN o AI riempiono, mostrare pill "auto da AI/VIN" e bottone "modifica" |
| KW ↔ CV | Indipendenti | Auto-calcolo bidirezionale (CV ≈ KW × 1.36) con flag "modificato manualmente" per disabilitare il sync |
| Peso totale | Indipendente | Auto-sum `pesoMotrice + pesoRimorchio` se entrambi presenti (solo se l'utente non l'ha toccato) |
| Data Nascita conducente | Manuale | Parser da Codice Fiscale (se presente nel conducente o nel cliente quando conducente = contraente) + bottone "Copia da contraente" |
| Nome/Cognome/CF conducente | Manuale | Toggle "Conducente = Contraente" che copia automaticamente tutti i dati anagrafici dal cliente selezionato (già caricato) |
| Tipo Patente | Manuale | Default `B` per AUTOVETTURA, `A` per MOTOCICLO, `C/CE` per AUTOCARRO (solo se vuoto) |
| Data rilascio patente | Manuale | Warning se età < 18 alla data; validazione cross-check con data nascita |

## 3. Pre-compilazione automatica dall'AI (PDF polizza)

Nel `handleAIImportApply` (file `ImmissionePolizzaPage.tsx`) già esiste il blocco `v` e `cond`. Estendere:

- Mostrare un toast/banner riepilogo "AI ha riempito: X campi veicolo + Y campi conducente — passa il mouse sui campi auto-compilati"
- Ogni campo auto-compilato riceve un piccolo indicatore visivo (bordo `border-l-2 border-primary` o icona ✨ accanto al label) finché l'utente non lo modifica.
- Estendere lo schema dell'edge function `parse-polizza-completa` per richiedere esplicitamente all'AI (campi già presenti vanno solo prompt-rafforzati):
  - veicolo: `classe_bm`, `data_immatricolazione`, `cv`, `kw`, `cc`, `posti`, `peso_*`, `tipo_alimentazione`, `tipologia_guida`, `franchigia`, `massimali[]`, flags (peius/temporanea/competizione/rimorchio/carico_scarico)
  - conducente: `nome`, `cognome`, `cf`, `data_nascita`, `indirizzo`, `cap`, `citta`, `provincia`, `tipo_patente`, `data_rilascio_patente`
- Mapping nel client: tutti questi campi → relativi setState già esistenti.
- Fallback intelligente: se l'AI non torna `provincia_circolazione` ma torna l'indirizzo conducente, usa quella provincia.

## 4. Validazioni e blocchi salvataggio (soft)

Aggiungere a `saveBlockReason` (o warning non bloccanti):
- Targa formato non valido → warning
- VIN ≠ 17 caratteri → warning
- Provincia circolazione non valida → warning
- Data rilascio patente < 18° compleanno → warning
- Anno acquisto > anno corrente → warning

## 5. Dettagli tecnici

- File toccati: `src/pages/ImmissionePolizzaPage.tsx` (riscrittura sezioni 2253-2374), `supabase/functions/parse-polizza-completa/index.ts` (estensione schema + prompt), `src/lib/rcaConstants.ts` (lista PROVINCE_IT se manca), eventuale nuovo `src/lib/vinDecoder.ts` (chiamata NHTSA API), eventuale nuovo `src/lib/cfParser.ts` (data nascita da CF — se non già presente, controllare prima).
- Riusare `AddressAutocomplete` (`src/components/AddressAutocomplete.tsx`) con prop `onSelect` per mappare i componenti su CAP/Città/Provincia.
- Google Maps è già configurato nel progetto (browser key `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`). Nessun nuovo connector.
- NHTSA decode è API pubblica (no key): `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json` — chiamata client-side.
- Nessuna modifica schema DB.
- Bump `public/version.json`.

## 6. Out of scope

- Nessun cambio business logic salvataggio (campi salvati su `polizze_rca_dati` invariati).
- Niente refactor della sezione Garanzie (già fatto in precedenza).
- Niente modifiche al flusso Importi/Tassazione.

## Ordine implementazione consigliato

1. Estendere schema AI + prompt (più dati estratti = utente vede subito il valore)
2. Aggiungere AddressAutocomplete + SearchableSelect provincia
3. Toggle "Conducente = Contraente" + auto-copy da CF
4. Decode VIN
5. Auto-calcoli KW/CV + peso totale
6. Restyling grafico (sub-headers, grid, h-9, flags box)
7. Indicatori visivi campi auto-compilati
8. Validazioni soft

Confermi e procedo, oppure preferisci che faccia prima solo i punti 1-2-6 (massimo impatto, minimo rischio) e gli altri in step successivo?
