

## Piano: Auto-compilazione campi da Codice Fiscale

### Cosa fa

Quando l'utente digita un codice fiscale italiano valido (16 caratteri), il sistema estrae automaticamente:
- **Sesso** (M/F) — dal carattere del mese (A-E-H-L-M-P-R-S-T = M, il giorno > 40 = F)
- **Data di nascita** — anno (pos 6-7), mese (pos 8), giorno (pos 9-10, se >40 sottrarre 40)
- **Comune di nascita** — codice catastale (pos 11-14), lookup su tabella comuni

Questo evita di scrivere due volte gli stessi dati. Si applica ovunque ci sia un campo codice fiscale.

### Struttura

**1. Utility `src/lib/parseCF.ts`** (nuovo file)

Funzione pura `parseCF(cf: string)` che restituisce `{ sesso, dataNascita, codiceCatastale } | null`:
- Valida lunghezza 16 e formato regex
- Estrae anno, mese (da lettera), giorno (sottraendo 40 se femmina)
- Restituisce sesso "M" o "F" e data in formato "YYYY-MM-DD"
- Restituisce il codice catastale (4 char) per lookup comune

**2. Tabella comuni** — array statico con i ~8000 codici catastali italiani e il relativo comune/provincia. File `src/lib/comuniItaliani.ts` con le voci principali (~300 comuni piu frequenti) per non appesantire il bundle. In alternativa, query su una tabella DB `comuni_italiani` se gia presente.

**3. Applicazione in `ClientiList.tsx`** (creazione cliente)

Aggiungere un `useEffect` o handler `onBlur` sul campo codice fiscale:
- Quando CF raggiunge 16 char validi, chiama `parseCF`
- Auto-compila: `sesso`, `dataNascita`, `comuneNascita`, `provinciaNascita`
- Non sovrascrive campi gia compilati manualmente (solo se vuoti)
- Mostra toast informativo "Dati estratti dal CF"

**4. Applicazione in `ClienteDetail.tsx`** (modifica cliente)

Stesso meccanismo quando si modifica il CF in fase di edit.

**5. Applicazione in `DocPrecontrattualePage.tsx`**

Se il CF viene inserito, auto-compilare eventuali campi collegati disponibili.

### Modifiche per file

| File | Modifica |
|---|---|
| **`src/lib/parseCF.ts`** | Nuovo: funzione `parseCF()` con parsing completo CF italiano |
| **`src/lib/comuniItaliani.ts`** | Nuovo: mappa codice catastale → {comune, provincia} per i ~300 comuni piu comuni |
| **`src/pages/ClientiList.tsx`** | Aggiungere handler su campo CF che chiama `parseCF` e auto-compila sesso, data nascita, comune/provincia nascita se vuoti |
| **`src/pages/ClienteDetail.tsx`** | Stesso auto-fill quando CF viene modificato |

### Note tecniche
- Il parsing e completamente client-side, nessuna chiamata API
- I campi vengono compilati solo se attualmente vuoti (non si sovrascrive input manuale)
- Il codice catastale copre i comuni piu frequenti; per i restanti il campo resta vuoto e l'utente compila manualmente

