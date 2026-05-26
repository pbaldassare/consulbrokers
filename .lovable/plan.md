# Piano

Due interventi indipendenti, entrambi confermati capiti come da messaggio:

1. **GG Mora ↔ Limite Mora**: oggi sono campi scollegati nella UI di Immissione e in TitoloDetail c'è solo un calcolo parziale (mora→data se data vuota). Vanno collegati in entrambi i versi, salvati su `titoli.mora_giorni` e `titoli.limite_mora` (già esistono), e usati come chiave per filtri futuri (scadenziari, polizze in mora, ecc.).
2. **Account Executive con provvigioni**: oggi l'AE (`titoli.ae_anagrafica_id`) è solo informativo. Va trattato come secondo beneficiario alla pari del Produttore (`anagrafica_commerciale_id`): se entrambi presenti le loro % si sommano, restano due righe distinte in `provvigioni_generate`, il residuo (100 − %produttore − %AE) va a Consul (riga `admin`).

---

## 1) GG Mora ↔ Limite Mora — binding + persistenza

### Regola di calcolo
- Base date = `data_competenza` (fallback `garanzia_da`).
- `limite_mora = base_date + mora_giorni` (mora_giorni ≥ 0, intero).
- Se l'utente cambia `mora_giorni` → ricalcola `limite_mora`.
- Se l'utente cambia `limite_mora` manualmente → ricalcola `mora_giorni = diff(limite_mora, base_date)` (min 0).
- Se cambia `data_competenza` e `mora_giorni` è valorizzato → ricalcola `limite_mora`.
- Default `mora_giorni = 15` (come oggi al salvataggio).
- Entrambi salvati su `titoli`: `mora_giorni` (int) e `limite_mora` (date) — già presenti, nessuna migrazione.

### File da modificare
- `src/pages/ImmissionePolizzaPage.tsx` (blocco Periodo, righe ~1598-1616): aggiungere `useEffect` su `dataCompetenza`/`moraGiorni` e handler `onChange` di `Limite Mora` che derivano l'altro.
- `src/pages/TitoloDetail.tsx` (blocco Periodo editabile inline, intorno alle righe 2355-2415): rendere il binding bidirezionale (oggi è solo mora→data e solo se data vuota) e applicarlo anche quando l'utente modifica `data_competenza`.
- Salvataggio: già esistente in entrambe le pagine, basta assicurarsi che entrambi i campi finiscano nel payload (in Immissione già ci sono).

### Memoria
- Nuovo file `mem://insurance/policy-mora-binding.md`: regola di calcolo + sorgente di verità in DB.

---

## 2) Account Executive come secondo intermediario provvigionato

### Modello dati
- Aggiungere su `titoli` la colonna `percentuale_ae numeric` (default `0`) — quota provvigionale spettante all'AE, indipendente da `percentuale_commerciale` (che resta del Produttore).
- Nessun cambio a `titoli_split_commerciali` (resta per split multipli del solo Produttore/commerciale).
- Vincolo logico applicato in UI ed edge function: `percentuale_commerciale + percentuale_ae ≤ 100`. Il residuo va a Consul.

### UI — sezione "Commerciale & Provvigioni" (Immissione e TitoloDetail)
- Affianco alla riga **Produttore + % Produttore** (oggi etichettata "% Commerciale") aggiungere riga **Account Executive + % AE** (visibile solo se `ae_anagrafica_id` valorizzato; selezione AE esistente).
- Mostrare in tempo reale: `Quota Produttore €`, `Quota AE €`, `Quota Consul €` (= residuo) calcolate su `provvigioni_quietanza`.
- Validazione: somma > 100 → errore bloccante con toast.
- Rinominare label UI "% Commerciale" → "% Produttore" per coerenza terminologica (DB resta `percentuale_commerciale`).

### Edge function `calcola-provvigioni`
- Caricare `percentuale_ae` e `ae_anagrafica_id` dal titolo.
- Dopo aver generato le righe degli split commerciali (Produttore), aggiungere — se `percentuale_ae > 0` e `ae_anagrafica_id` non nullo — una riga `provvigioni_generate` con:
  - `tipo_destinatario = 'ae'` (nuovo valore consentito, in alternativa riusare `'commerciale'` con flag — vedi sotto)
  - `anagrafica_commerciale_id = ae_anagrafica_id`
  - `percentuale = percentuale_ae`
  - `importo_provvigione = totale * percentuale_ae / 100`
  - `solo_statistico = (ae_anagrafica_id === adminAnagraficaId)` (stesso pattern del caso "commerciale = admin")
- Aggiornare il calcolo della riga `admin` (Consul): `percAdmin = 100 − sumProduttore − percentuale_ae` (residuo).
- Se `tipo_destinatario` ha un CHECK constraint, va esteso con `'ae'`: verifica e, se serve, migrazione `ALTER ... DROP CONSTRAINT / ADD CONSTRAINT` con la nuova lista valori. (Da confermare al momento dell'implementazione leggendo lo schema.)

### Report e pagamenti
- `ProvvigioniMaturatePage`, distinte di pagamento, E/C Produttore: gestire il nuovo `tipo_destinatario = 'ae'` come destinatario pagabile (stessa logica del Produttore, badge "AE" distinto). Filtro `solo_statistico = false` invariato.
- `lib/ec-produttore-pdf.ts`: l'AE riceve il suo E/C basato sulle righe con `tipo_destinatario = 'ae'` e `anagrafica_commerciale_id = <ae>`.

### Memoria
- Aggiornare `mem://insurance/policy-commission-split.md`: documentare il nuovo split a 3 livelli (Produttore + AE + Consul residuo) e il flag `tipo_destinatario = 'ae'`.

---

## Sezione tecnica (riassunto)

| Cosa | Tipo | Dove |
|---|---|---|
| `titoli.percentuale_ae numeric default 0` | nuova colonna | migrazione SQL |
| Eventuale estensione CHECK su `provvigioni_generate.tipo_destinatario` per includere `'ae'` | migrazione SQL condizionale | da verificare a runtime |
| Binding bidirezionale GG Mora/Limite Mora | UI + effetti | `ImmissionePolizzaPage.tsx`, `TitoloDetail.tsx` |
| Riga "AE + % AE" nella sezione Commerciale | UI | `ImmissionePolizzaPage.tsx`, `TitoloDetail.tsx` |
| Generazione riga `provvigioni_generate` per AE | edge function | `supabase/functions/calcola-provvigioni/index.ts` |
| Badge/filtro `tipo_destinatario='ae'` | UI | `ProvvigioniMaturatePage`, distinte, E/C |
| Memorie | doc | `policy-mora-binding.md` (nuovo), `policy-commission-split.md` (update) |

Nessuna modifica retroattiva ai titoli esistenti: `percentuale_ae` parte a `0`, comportamento storico invariato finché non viene valorizzata.

Confermi e procedo in build?
