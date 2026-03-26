

## Piano: Pagina Analisi Documenti AI Multi-File

### Cosa si costruisce

Una nuova pagina `/portafoglio/analisi-preventivo-rca` dove l'utente può caricare **più file contemporaneamente** (foto e PDF) e l'AI li analizza tutti in parallelo, estraendo dati strutturati da ciascun documento (premi RCA, infortuni, garanzie, dati cliente, ecc.).

### Implementazione

**1. Nuova Edge Function `analisi-documenti-multipli/index.ts`**
- Accetta un array di file (base64 + mime_type) e un `tipo_analisi`
- Per il tipo `preventivo_rca`: schema tool-calling con campi cliente (contraente, CF, targa, veicolo), premi lordi per ramo (RCA, infortuni, furto/incendio, kasko, cristalli, assistenza, tutela legale, altri), totale, e array garanzie (nome, massimale, franchigia, premio)
- Elabora ogni file in una chiamata AI separata, poi aggrega i risultati
- Gestione errori 429/402

**2. Nuovo file `src/pages/AnalisiPreventivoRCAPage.tsx`**
- **Upload multi-file**: zona drag & drop che accetta più file contemporaneamente (`multiple` su input)
- Anteprima dei file caricati con possibilità di rimuoverli prima dell'invio
- Bottone "Analizza tutti" che invia i file alla edge function
- Progress bar per ogni file in elaborazione
- **Risultati**: per ogni documento analizzato, una sezione Card con:
  - Dati Cliente (contraente, CF, targa, veicolo, date)
  - Tabella Riepilogo Premi (RCA, Infortuni, Furto/Incendio, Kasko, Cristalli, Assistenza, Tutela Legale, Altri, **Totale**)
  - Tabella Dettaglio Garanzie (nome, massimale, franchigia, premio, inclusa)
- Possibilità di confrontare i risultati tra più documenti affiancati

**3. Rotta e Sidebar**
- Aggiungere rotta `/portafoglio/analisi-preventivo-rca` in `src/routes/portafoglio.tsx`
- Aggiungere voce nella sidebar sotto Portafoglio

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File creati | `supabase/functions/analisi-documenti-multipli/index.ts`, `src/pages/AnalisiPreventivoRCAPage.tsx` |
| File modificati | `src/routes/portafoglio.tsx`, `src/components/AppSidebar.tsx` |
| AI model | `google/gemini-2.5-flash` via Lovable AI Gateway |
| Upload | Multi-file, PDF/immagini, max 10MB ciascuno, max 10 file |
| Elaborazione | Chiamate AI in parallelo (Promise.all), una per file |

### Schema tool-calling `preventivo_rca`

```text
contraente, codice_fiscale, targa, veicolo_marca_modello
data_effetto, data_scadenza
premio_lordo_rca, premio_lordo_infortuni, premio_lordo_furto_incendio
premio_lordo_kasko, premio_lordo_cristalli, premio_lordo_assistenza
premio_lordo_tutela_legale, premio_lordo_altri, premio_lordo_totale
garanzie[]: nome_garanzia, massimale, franchigia, premio, inclusa
```

