

## Piano: Conferimento Gestito + Flag "In Attesa Fondi"

### Concetto
Accanto al pulsante "Metti a Cassa" (= Conferma Incasso, soldi già in cassa), aggiungere un secondo pulsante **"Conferimento Gestito"** per incassare il premio senza avere ancora i soldi in conto. Questo:
- Mette a cassa il titolo (stato → `incassato`, date compilate)
- Salva un flag `conferimento_gestito = true` e `fondi_ricevuti = false` sul titolo
- Apre un popup dove l'utente conferma di assumersi la responsabilità (riferimento alla circolare)
- In E/C Compagnia il titolo apparirà con un badge "In Attesa Fondi"
- Quando i soldi arrivano, si potrà marcare `fondi_ricevuti = true`

### 1. Migrazione DB

```sql
ALTER TABLE titoli
  ADD COLUMN IF NOT EXISTS conferimento_gestito boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fondi_ricevuti boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_conferimento_gestito date;
```

- `conferimento_gestito`: true se l'incasso è avvenuto senza fondi in cassa
- `fondi_ricevuti`: false = ancora in attesa dei soldi (default true per gli incassi normali)
- `data_conferimento_gestito`: data dell'operazione

### 2. TitoloDetail.tsx — Nuovo pulsante + Dialog

Accanto a "Metti a Cassa", aggiungere un pulsante arancione **"Conferimento Gestito"** (visibile solo se `stato === "attivo"`).

Il dialog conterrà:
- Titolo: "Conferimento Gestito"
- Testo della circolare di riferimento (dichiarazione di responsabilità)
- Checkbox obbligatorio: "Dichiaro di assumermi la responsabilità dell'incasso"
- Stessi campi data del dialog incasso (Data Messa a Cassa, Data Pagamento, Data Decorrenza)
- Bottone "Conferma Conferimento"

Alla conferma: stessa logica di `changeStatoMutation` con `nuovoStato: "incassato"` + campi aggiuntivi `conferimento_gestito: true`, `fondi_ricevuti: false`, `data_conferimento_gestito: oggi`.

### 3. Sezione Messa a Cassa — Indicatore visivo

Quando il titolo è `incassato` e `conferimento_gestito = true`:
- Mostrare badge arancione "Conferimento Gestito"
- Se `fondi_ricevuti = false`: badge rosso "In Attesa Fondi" + pulsante "Segna Fondi Ricevuti"
- Se `fondi_ricevuti = true`: badge verde "Fondi Ricevuti"

### 4. E/C Compagnia — Flag visivo

Nella tabella dei titoli espansi per compagnia, aggiungere una colonna/badge che indica se il titolo è in "Conferimento Gestito" con fondi ancora da ricevere.

### 5. Incassi e Coperture (PortafoglioCaricoPage)

Il titolo con conferimento gestito apparirà normalmente tra gli incassati (stesso flusso), con badge "Conferimento Gestito" nella lista.

### File coinvolti
- **Migrazione SQL**: 3 nuove colonne su `titoli`
- **`TitoloDetail.tsx`**: Nuovo pulsante, nuovo dialog, badge, pulsante "Segna Fondi Ricevuti"
- **`ECCompagniaContabPage.tsx`**: Badge/flag per conferimenti gestiti in attesa fondi
- **`PortafoglioCaricoPage.tsx`**: Badge conferimento gestito nella lista incassi

