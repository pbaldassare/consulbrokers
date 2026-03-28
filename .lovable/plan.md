

## Piano: Aggiungere descrizioni alle pagine nella Mappa delle Sezioni

### Modifica
Aggiungere un campo `descrizione` a ogni voce `pagina` nell'array `sezioni` di `SitemapPage.tsx`, e mostrarlo sotto il nome della pagina nel componente `SezioneCard`.

### Descrizioni per ogni sezione

**Home**
- Dashboard: Pannello principale con KPI, grafici e feed attivita in tempo reale, profilato per ruolo

**Archivi**
- Clienti: Lista unificata di tutti i clienti (privati, aziende, enti) con ricerca avanzata multi-campo
- Dettaglio Cliente: Scheda completa del cliente con dati anagrafici, polizze, sinistri, documenti e timeline
- Anagrafiche Professionali: Gestione periti, medici, legali, carrozzerie e altri professionisti collegati

**Prospect & Trattative**
- Lista Prospect: Elenco contatti potenziali non ancora clienti, con stato e assegnazione
- Dettaglio Prospect: Scheda del prospect con storico contatti e conversione a cliente
- Trattative: Pipeline commerciale con preventivi, stato negoziazione e conversione

**Portafoglio**
- Lista Portafoglio: Vista complessiva di tutte le polizze attive, scadute e in lavorazione
- Dettaglio Portafoglio: Scheda polizza con garanzie, premi, movimenti e documenti allegati
- Gestione Polizze: Operazioni massive su polizze (filtri avanzati, azioni batch)
- Immissione Polizza: Inserimento nuova polizza con wizard guidato
- Rinnovi: Gestione rinnovi in scadenza con conferma o modifica condizioni
- Storno Polizza: Annullamento polizza con calcolo rateo e generazione documentazione
- Sospensione Polizza: Sospensione temporanea copertura con date e motivazione
- Riattivazione Polizza: Ripristino polizza precedentemente sospesa
- Appendici Polizza: Modifica condizioni polizza in corso (variazioni, integrazioni)
- Duplicazione Polizza: Copia polizza esistente come base per nuova emissione
- Conferma Emittende: Conferma emissione polizze in attesa di validazione
- Titoli: Gestione titoli di incasso (quietanze, ricevute) collegati alle polizze

**Sinistri**
- Lista Sinistri: Elenco sinistri con filtri per stato, data, compagnia e tipo
- Dettaglio Sinistro: Scheda sinistro con cronologia, perizie, documenti e liquidazioni
- Analisi Preventivo RCA: Strumento di analisi e simulazione preventivi RC Auto
- Doc Precontrattuale: Generazione documentazione precontrattuale obbligatoria

**Contabilita Ufficio**
- Contabilita Ufficio: Pannello principale contabilita della sede con riepilogo movimenti
- Cruscotto Giornaliero: Situazione contabile del giorno con incassi e sospesi
- Distinta Giornaliera: Distinta di cassa giornaliera con dettaglio operazioni e chiusura
- Quadratura Premi: Verifica corrispondenza tra premi incassati e premi dovuti
- Chiusura Contabile: Chiusura periodo contabile con generazione report
- E/C Clienti: Estratto conto per singolo cliente con saldo e movimenti
- E/C Compagnia: Estratto conto verso compagnia con premi e provvigioni
- E/C Produttori: Estratto conto produttore con provvigioni maturate e liquidate
- Import Provvigioni: Importazione file provvigioni da compagnie (PDF/Excel)
- Diff. Provvigioni: Analisi differenze tra provvigioni attese e ricevute
- Report IVA: Report IVA periodico per adempimenti fiscali

**Contabilita Generale**
- Piano dei Conti: Struttura gerarchica conti e centri di costo
- Primanota Generale: Registrazione movimenti contabili generali
- Scadenziario: Scadenze pagamenti fornitori e incassi attesi
- Clienti Contabilita: Anagrafica clienti ai fini della contabilita generale
- Elaborazioni Periodiche: Bilancini, situazioni patrimoniali ed economiche periodiche
- Elaborazioni Annuali: Bilancio annuale e chiusura esercizio
- Dichiarativi CU: Generazione Certificazioni Uniche per collaboratori
- Fornitori: Anagrafica fornitori con dati fiscali e contabili
- Import Bancario: Importazione e riconciliazione movimenti bancari

**Estrazioni & Stampe**
- Estrazioni e Stampe: Hub centrale per report e stampe personalizzate
- Portafoglio per Cliente: Estrazione portafoglio raggruppato per cliente
- Portafoglio per Compagnia: Estrazione portafoglio raggruppato per compagnia
- Premi e Provvigioni: Report premi e provvigioni con filtri temporali e per compagnia
- Premi Scoperti/Garantiti: Analisi premi scoperti vs garantiti per valutazione rischio
- E/C Clienti (Estrazioni): Estratti conto clienti in formato esportabile

**Sistema**
- Impostazioni: Configurazione parametri generali del sistema e della sede
- Crea Utente: Creazione nuovo utente con assegnazione ruolo e sede
- Gestione Utenti: Lista utenti con modifica ruoli, permessi e stato attivazione
- Anomalie Sistema: Monitoraggio anomalie, errori e incongruenze nei dati
- Backup & Export: Esportazione dati e backup del database
- Manutenzione: Operazioni di manutenzione tecnica del sistema
- Tabelle di Base: Gestione tabelle di lookup (rami, zone, indotti, settori, ecc.)
- Compagnie: Anagrafica compagnie assicurative con categorie e prodotti
- Gestione Sedi: Configurazione sedi operative dell'agenzia
- Template Email: Modelli email personalizzabili per comunicazioni automatiche
- Sitemap: Questa pagina — organigramma ruoli e mappa funzionale

**Altre Funzioni**
- Area CFO: Cruscotto finanziario con indicatori economici aggregati
- Provvigioni Sede: Gestione provvigioni per sede con dettaglio per compagnia e ramo
- Pagamenti Provvigioni: Registrazione e monitoraggio pagamenti provvigioni ai produttori
- Rimessa Premi: Gestione rimesse premi alle compagnie con scadenze e saldi
- Notifiche: Centro notifiche con avvisi di sistema, scadenze e comunicazioni
- Comunicazioni: Invio e gestione comunicazioni email/PEC a clienti e compagnie
- Spedizioni: Tracciamento spedizioni documenti e corrispondenza
- Note Restituzione: Gestione note di credito e restituzioni da compagnie
- Flussi Compagnie: Importazione e gestione flussi dati dalle compagnie
- Privacy & Consensi: Gestione consensi GDPR e documentazione privacy clienti
- Report: Report statistici e analitici personalizzabili
- Documentale: Archivio documentale con cartelle e upload file
- Chat Interna: Messaggistica interna tra operatori con canali tematici

**Portale Cliente**
- Dashboard Cliente: Riepilogo personale con polizze attive, scadenze prossime e avvisi
- Le mie Polizze: Lista polizze personali con stato e dettagli copertura
- Dettaglio Polizza: Visualizzazione completa di una polizza con garanzie e documenti
- Documenti: Archivio documenti personali e contrattuali scaricabili
- Scadenze: Calendario scadenze polizze e pagamenti
- Pagamenti: Storico pagamenti e situazione contabile personale
- Sinistri: Visualizzazione e apertura sinistri personali
- Upload Documenti: Caricamento documenti richiesti dall'agenzia
- Comunicazioni: Messaggi scambiati con l'agenzia
- Notifiche: Avvisi e promemoria personali

### Modifica UI
Nel componente `SezioneCard`, sotto il nome di ogni pagina verra mostrata la descrizione in testo piu piccolo e colore attenuato.

### File modificato
- `src/pages/SitemapPage.tsx`

