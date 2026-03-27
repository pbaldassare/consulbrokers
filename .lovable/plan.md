

## Piano: Creare le tabelle di lookup e popolarle con i dati dal vecchio sistema

### Problema
Le 7 tabelle di lookup (`lookup_zone`, `lookup_indotti`, `lookup_attivita`, `lookup_settori`, `lookup_contratti`, `lookup_fasce_fatturato`, `lookup_fasce_dipendenti`) **non esistono nel DB** — la migrazione precedente non le ha mai create. La UI (TabelleBasePage) e gli hook (useLookupTables) le referenziano ma puntano al vuoto.

Inoltre, `gruppi_finanziari` ha i dati sbagliati — usiamo le descrizioni invece dei nomi corretti dal vecchio sistema.

### Dati estratti dalle foto

**Zone** (14 valori):
CENTRO, EMILIA ROMAGNA, ESTERO, FRIULI VENEZIA GIULIA, ISOLE, LAZIO, LOMBARDIA, NORD-EST, NORD-OVEST, PIEMONTE, SUD, TRENTINO ALTO ADIGE, VENETO

**Settori** (8 valori):
Agricoltura, Edilizia Privata, Edilizia Pubblica, Gestione Rifiuti, Ser. idrico/Gest. rifiuti, Servizi Promoz. Turistica, Servizi Sociali, Servizi Vari Alla P.A.

**Fasce Fatturato** (7 valori, ordinati):
1. fino a 2 milioni
2. da 2 a 5 milioni
3. da 5 a 10 milioni
4. da 10 a 50 milioni
5. da 50 a 100 milioni
6. da 100 a 200 milioni
7. oltre 200 milioni

**Fasce Dipendenti** (5 valori, ordinati):
1. Fino a 9
2. da 10 a 49
3. da 50 a 249
4. da 250 a 499
5. oltre 500 dipendenti

**Attivita** (visibili nella foto, lista parziale ma lunga — ~30+ voci):
AEREOPORTI, AGENTI, AGRICOLTORI, ALIMENTARI, Amministratore Unico, Architetto, ARTIGIANI, ASSESSORE, ASSISTENZA UNIVERSITARIA, ASSOC. VOLONTARIATO, Attività di assistenza diurna per l'infanzia, AZIENDA AGRICOLA, BANCHE, BROKERS, CASSE PREVIDENZIALI, CATEGORIA DA DEFINIRE, COMANDANTE POLIZIA LOCALE, Commercialista, COMMERCIALISTI, COMMERCIANTI, Commissario Liquidatore, COMPAGNIE DI ASSICURAZ., COMPAGNIE DI NAVIGAZIONE, CONCESSIONARIE PARMALAT, CONSIGLIERE, Consigliere Comunale
(la lista continua ma la foto è tagliata — inserisco quelli visibili)

**Indotto**: Dal vecchio sistema si vedono valori come "Gruppo ENTI PUBBLICI", "Gruppo ENTI PUBBLICI DIVERSI", "Gruppo dipendenti AMGA SpA", ecc. Questi sono raggruppamenti specifici per cliente/network. Creo la tabella con i valori base visibili.

**Contratto**: La foto mostra solo "Specificare il Contratto" — creo la tabella vuota, da popolare dopo.

**Gruppi Finanziari** — Aggiornare `nome` con i valori corretti dal vecchio sistema:
Ass.ne Sportiva Dilettantistica, Associazione Culturale, Associazione di Promozione Sociale, Associazione Volontariato, Azienda Partecipata Pubblica, Aziende Private, Aziende Sanitarie Private, Aziende Sanitarie Pubbliche, Ente autonomo funzionale di diritto, Ente Pubblico Economico, Enti Pubblici Senza Scopo di Lucro, Enti Pubblici Strumentali, Enti Pubblici Territoriali, Farmaceutico, I.P.A.B., Linea Persona

### Cosa fare

**1 migrazione SQL** che:
- Crea le 7 tabelle di lookup con struttura `id uuid PK, codice text UNIQUE, descrizione text, attivo boolean DEFAULT true, created_at timestamptz`
- Le tabelle fasce hanno anche `ordine integer`
- Abilita RLS su tutte (SELECT per authenticated, INSERT/UPDATE/DELETE per admin)
- Popola tutte le tabelle con i dati dalle foto
- Aggiorna `gruppi_finanziari` con i nomi corretti dal vecchio sistema (cancella e reinserisce con i valori giusti)
- Aggiunge le colonne `fascia_fatturato text` e `fascia_dipendenti text` a `clienti` (se non esistono già)

### File da modificare
- **1 nuova migrazione SQL** — crea tabelle, popola dati, fix gruppi_finanziari
- **`src/integrations/supabase/types.ts`** — aggiungere i tipi per le 7 nuove tabelle

### Nessuna modifica UI
La UI (TabelleBasePage, ClienteDetail, ClientiList) e gli hook (useLookupTables) referenziano già queste tabelle — basta crearle nel DB.

