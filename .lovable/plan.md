

## Piano: Revisione e miglioramenti Distinta Giornaliera

Ho letto `src/pages/contabilita/DistintaGiornaliera.tsx` (522 righe) e l'edge function `genera-distinta-pdf`. La pagina è già funzionante (genera distinta da movimenti, KPI per tipo pagamento, chiusura/riapertura, export CSV/PDF). Ho però individuato **6 problemi reali** da risolvere.

### Problemi individuati e fix

**1. Nome Sede sempre "Ufficio" nel PDF** (riga 214)
   - Attualmente: `ufficio_nome: profile?.ufficio_id ? "Ufficio" : "—"`
   - Fix: fetch del nome ufficio via `uffici.nome_ufficio` e passarlo al PDF

**2. Quadratura cassa mai calcolata**
   - I campi `saldo_cassa_atteso` e `differenza_cassa` esistono in DB ma non vengono mai valorizzati alla generazione (riga 112-126)
   - Fix: calcolare `saldo_cassa_atteso = totale_contanti` (cassa fisica attesa) e mostrare la differenza al chiudi-distinta con input manuale per il "contato effettivo"

**3. KPI "mov." sempre 0 per Assegni/Bonifici/POS**
   - Riga 334: `raggruppamento[k.label.toLowerCase()]` cerca chiavi tipo "assegni" ma in DB possono essere singolari ("assegno", "bonifico"). Mappa incoerente
   - Fix: normalizzare i tipi a forma singola (sia in raggruppamento sia in lookup KPI)

**4. Toast errori muti** (riga 149, 242)
   - `toast.error("Errore")` senza dettaglio. Fix: includere `e.message`

**5. Pulsante "Rigenera"** mancante quando ci sono nuovi movimenti dopo la generazione
   - Aggiungo banner "Ci sono N nuovi movimenti non inclusi nella distinta" + bottone Aggiorna righe (solo se distinta non chiusa)

**6. Storico distinte non visibile**
   - Il dato `storico` viene fetchato ma mai renderizzato. Aggiungo tab/card "Storico ultime 30 distinte" con click per navigare alla data

### File coinvolti
- ✏️ `src/pages/contabilita/DistintaGiornaliera.tsx` — fix nome sede, normalizzazione tipi pagamento, quadratura cassa, banner nuovi movimenti, sezione storico, toast con dettaglio errore
- ✏️ `supabase/functions/genera-distinta-pdf/index.ts` — nessuna modifica necessaria (riceve già `ufficio_nome` come parametro)

