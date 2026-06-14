
## Obiettivo

Il nuovo Excel (`4464_matched_v2`) contiene già la colonna **`Cliente ID`** (UUID del cliente DB) pre-matchata. Quindi l'upload deve diventare un semplice **load + bind** senza step di matching AI né conferme di assegnazione. Prima però va azzerato lo stato attuale.

## Stato attuale

- 107 righe in `movimenti_bancari`, 1 in `movimenti_clienti`, 1 in `movimenti_polizze`.
- L'Excel ha colonne: `Data contabile`, `Data valuta`, `Importo`, `Ordinante`, `Cliente DB`, **`Cliente ID`**, `Match`, `Descrizione`.
- La pagina `CaricamentoMovBancariPage`:
  - importa col `stato = 'importato'`,
  - richiede "Avvia AI Matching",
  - poi tab Revisione con bottoni Approva / Rifiuta / Assegna manuale per portare a `assegnato`.

## Azione

### 1. Reset dati (SQL)

```sql
DELETE FROM movimenti_polizze;
DELETE FROM movimenti_clienti;
DELETE FROM movimenti_bancari;
```

(Nessuna FK esterna a `movimenti_bancari` oltre a queste due tabelle; il ricongiungimento esistente — l'unica riga — viene azzerato di proposito.)

### 2. Refactor `src/pages/contabilita/CaricamentoMovBancariPage.tsx`

Nel parser `handleFile`:
- Riconoscere le colonne del nuovo formato:
  - `data_movimento` ← `Data contabile` (fallback `Data valuta`)
  - `importo` ← `Importo`
  - `ordinante` ← `Ordinante`
  - `descrizione` ← `Descrizione`
  - `cliente_id` ← **`Cliente ID`** (UUID; se valido, viene scritto direttamente)
- Per ogni riga con `Cliente ID` valido:
  - recuperare in batch `ufficio_id` dal cliente (un'unica `SELECT id, ufficio_id FROM clienti WHERE id IN (...)`),
  - inserire con `stato = 'assegnato'` e `cliente_id` + `ufficio_id` valorizzati;
- Righe senza `Cliente ID` (rare con il nuovo file): inserite con `stato = 'importato'` come fallback, così non si perdono.
- Mantenere la deduplica esistente (data+importo+ordinante+descrizione).
- Rimuovere dalla UI:
  - card "Ultimo batch importato" + bottone "Avvia AI Matching" (e funzione `runMatching`);
  - tab "Revisione" (`RevisioneTab`) e relative azioni Approva/Rifiuta/Assegna.
- Mantenere:
  - tab "Importazione" (drop zone Excel),
  - tab "Monitor Real-time",
  - bottone "Inserimento manuale" (utile per casi sporadici).
- Dopo upload mostrare un riepilogo statico: `N movimenti caricati e assegnati · M duplicati · K senza Cliente ID`.

### 3. Pulizia collegata

- Nessuna modifica a `RicongiungimentoBancarioPage.tsx`: continua a leggere `stato IN ('assegnato','ricongiunti')` e ora vede subito tutti i movimenti caricati.
- Edge function `ai-match-movimenti-bancari` resta in DB ma non viene più invocata dalla UI (non la cancello in questa iterazione per sicurezza; se vuoi la rimuovo).

## Verifica

1. `/contabilita/caricamento-mov-bancari` non mostra più "Avvia AI Matching" né la tab Revisione.
2. Caricando `4464_matched_v2.xlsx` compaiono toast tipo `108 movimenti caricati e assegnati`.
3. `/contabilita/ricongiungimento-bancario` elenca i movimenti già abbinati al cliente, pronti per il ricongiungimento polizze.
4. `SELECT count(*) FROM movimenti_bancari WHERE stato='assegnato'` ≈ 108.

## Note

- L'Excel usa importi numerici (es. `54339` interpretato come `54339.00`): il parser corrente li gestisce.
- Se vuoi cancellare anche la edge function di AI matching, dimmelo nel prossimo giro.
