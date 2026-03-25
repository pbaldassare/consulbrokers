

## Piano: Potenziamento Contabilita e Contabilita Generale

### Analisi di cosa esiste

**Contabilita (polizze/provvigioni):**
- Incassi e movimenti contabili per ufficio (ContabilitaUfficio)
- E/C Clienti, Compagnia, Produttori
- Provvigioni generate + distinte pagamento
- Riconciliazione bancaria AI (import + matching)
- Portafoglio incassi con scadenze

**Contabilita Generale (costi/ricavi uffici):**
- Primanota Generale con fornitori e causali
- Scadenziario pagamenti fornitori
- Elaborazioni periodiche e annuali
- Dichiarativi/CU
- Import bancario

### Proposte di miglioramento — cosa implementare

#### 1. Dashboard Contabile Giornaliera ("Cruscotto del Giorno")
Una pagina che ogni mattina mostra in un colpo d'occhio:
- Incassi da verificare oggi (titoli con pagamento ricevuto ma non ancora registrato)
- Scadenze fornitore in scadenza oggi/settimana
- Movimenti bancari importati non ancora riconciliati
- Quadratura cassa: totale entrate vs totale uscite del giorno
- Differenze tra premi attesi e premi effettivamente arrivati sui conti

Questo sostituisce il controllo manuale mattutino che oggi richiede di aprire 4-5 schermate diverse.

#### 2. Distinta Giornaliera Automatica
Generazione automatica della distinta giornaliera degli incassi:
- Raggruppa tutti i movimenti del giorno per tipo (contanti, assegni, bonifici, POS)
- Calcola totali per modalita di pagamento
- Confronta con il saldo cassa atteso
- Esportazione PDF/CSV con layout pronto per la firma
- Storico distinte con possibilita di riapertura e correzione

#### 3. Verifica Arrivo Premi ("Quadratura Premi")
Pannello che incrocia automaticamente:
- Premi attesi (da titoli con stato "in attesa pagamento" o "da incassare")
- Movimenti bancari in entrata
- Segnala i premi NON arrivati dopo X giorni dalla scadenza
- Segnala importi che non corrispondono (differenze anche di pochi centesimi)
- Azione rapida: "Segna come incassato" con collegamento automatico al movimento bancario

#### 4. Chiusura Contabile Guidata
Workflow step-by-step per la chiusura mensile/trimestrale:
- Step 1: Verifica tutti i movimenti siano registrati
- Step 2: Riconciliazione bancaria completa (tutti gli estratti matchati)
- Step 3: Quadratura IVA (registro acquisti vs registro vendite)
- Step 4: Verifica scadenziario (nessuna scadenza dimenticata)
- Step 5: Generazione report di periodo
- Ogni step mostra uno stato (completato/da fare/con errori) con link diretto alla schermata

#### 5. Alert Intelligenti Contabili
Notifiche proattive generate automaticamente:
- "Il premio della polizza X doveva arrivare 5 giorni fa — ancora non risulta sul conto"
- "Scadenza fornitore Y tra 3 giorni — importo 1.200 EUR"
- "Differenza di quadratura di 15,30 EUR sulla cassa di oggi"
- "3 movimenti bancari da 7+ giorni non riconciliati"
- Configurabili per ufficio (soglie, tempistiche)

#### 6. Report Comparativo Uffici (per CFO)
Dashboard che confronta i dati contabili tra uffici:
- Entrate/uscite per ufficio nel periodo
- Tasso di riconciliazione bancaria per ufficio
- Tempo medio di incasso premi per ufficio
- Scadenze in ritardo per ufficio
- Grafici comparativi con Recharts

### Priorita suggerita di implementazione

| Priorita | Feature | Impatto |
|-----------|---------|---------|
| 1 | Dashboard Contabile Giornaliera | Risparmia 30min/giorno a ogni operatore |
| 2 | Distinta Giornaliera Automatica | Elimina lavoro manuale ripetitivo |
| 3 | Verifica Arrivo Premi | Previene perdite e dimenticanze |
| 4 | Alert Intelligenti | Riduce errori e ritardi |
| 5 | Chiusura Contabile Guidata | Standardizza il processo |
| 6 | Report Comparativo Uffici | Visibilita direzionale |

### Dettagli tecnici

**Tabelle DB necessarie:**
- `distinte_giornaliere` — storico distinte con dettaglio righe
- `distinte_giornaliere_righe` — singoli movimenti nella distinta
- `chiusure_contabili` — tracking workflow di chiusura con stato per step
- Le altre feature usano tabelle gia esistenti (movimenti_contabili, estratti_conto, titoli, notifiche)

**Pagine da creare:**
- `src/pages/contabilita/CruscottoGiornaliero.tsx`
- `src/pages/contabilita/DistintaGiornaliera.tsx`
- `src/pages/contabilita/QuadraturePremi.tsx`
- `src/pages/contabilita/ChiusuraContabile.tsx`
- `src/pages/ReportComparativoUffici.tsx`

**Approccio:** Ogni feature e indipendente. Si possono implementare una alla volta partendo dalla Dashboard Contabile Giornaliera che ha il maggior impatto immediato.

