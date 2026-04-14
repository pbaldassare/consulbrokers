

## Piano: Generazione automatica provvigioni alla messa a cassa + split commerciale/Consul

### Situazione attuale
- La **messa a cassa** in `PortafoglioCaricoPage` NON chiama `calcola-provvigioni` — quindi `provvigioni_generate` resta vuota
- La edge function `calcola-provvigioni` cerca `produttore_id` e `matrice_provvigioni`, ma i dati reali hanno `produttore_id = null` e usano i campi `provvigioni_quietanza` e `percentuale_commerciale` direttamente sul titolo
- I destinatari delle provvigioni sono 2 categorie:
  - **Commerciale** (AE, corrispondente, produttore) — `commerciale_id` con `percentuale_commerciale`
  - **Consul** (l'agenzia) — riceve il residuo `(100 - percentuale_commerciale)`
- I campi `provvigioni_quietanza` contengono già l'importo provvigione di agenzia per ogni polizza

### Cosa fare

**1. Aggiornare la Edge Function `calcola-provvigioni`**
- Nuovo approccio: usa `provvigioni_quietanza` dal titolo come base provvigione agenzia
- Se `percentuale_commerciale < 100` e `commerciale_id` esiste → genera 2 righe in `provvigioni_generate`:
  - Riga commerciale: `importo = provvigioni_quietanza * percentuale_commerciale / 100`, `user_id = commerciale_id`
  - Riga Consul: `importo = provvigioni_quietanza * (100 - percentuale_commerciale) / 100`, `user_id = null` (o un user Consul fisso)
- Se `percentuale_commerciale = 100` e nessun `commerciale_id` → genera 1 riga Consul con `provvigioni_quietanza` intero
- Fallback alla logica attuale `matrice_provvigioni` se `provvigioni_quietanza` è null

**2. Chiamare `calcola-provvigioni` dalla messa a cassa**
- In `PortafoglioCaricoPage.tsx`, dopo l'update a `incassato`, invocare `supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id } })`
- Sia nel singolo `mettiACassa` che nel `bulkMettiACassa`

**3. Aggiungere colonna `tipo_destinatario` a `provvigioni_generate`**
- Nuova colonna `tipo_destinatario TEXT` con valori: `commerciale`, `consul`, `sede`
- Permette di distinguere chi riceve cosa nella pagina Provvigioni Maturate

**4. Aggiornare la pagina `ProvvigioniMaturatePage`**
- Mostrare il tipo destinatario con badge colorato
- Filtrare: mostra solo provvigioni NON Consul (quelle Consul vanno già in Provvigioni Consul)
- Aggiungere colonna "Tipo" (Commerciale / Sede)

### File coinvolti
- **Modifica**: `supabase/functions/calcola-provvigioni/index.ts` — nuova logica di calcolo
- **Modifica**: `src/pages/PortafoglioCaricoPage.tsx` — invocare calcolo dopo messa a cassa
- **Migrazione**: aggiunta colonna `tipo_destinatario` a `provvigioni_generate`
- **Modifica**: `src/pages/ProvvigioniMaturatePage.tsx` — mostrare tipo destinatario

