## Obiettivo
Trasformare l'utenza demo "Comune di Varese" da prospect a **cliente ente** completo, in modo che possa accedere al portale `/cliente` (più ricco) e vedere polizze, sinistri, premi, grafici e report, con dati simulati persistenti per la demo.

## Stato attuale
- Profilo `746c540d-...` ruolo `prospect`, vede solo `/prospect` (dashboard minimale, trattative, documenti, chat).
- Prospect record `68178b0a-...` con `user_id` collegato, **non convertito** in cliente.
- Il portale `/cliente` è quello completo: Dashboard ricca con KPI, polizze, sinistri con grafici, scadenze, pagamenti, documenti, comunicazioni — tutto filtrato via RPC `get_my_cliente_ids()` che cerca per `clienti.user_id`.

## Strategia: conversione a cliente ente + seeding demo

### 1. Conversione prospect → cliente
- Creare record in `clienti` con:
  - `tipo_cliente='ente'`
  - `ragione_sociale='Comune di Varese'`
  - dati completi (P.IVA `00441340120`, indirizzo Via Sacco 5 21100 Varese VA, PEC, telefono `0332 255111`)
  - `ufficio_id='327e92f7-...'` (SEDE SAN DONÀ DI PIAVE)
  - `user_id='746c540d-...'` (collega all'utenza demo)
  - `codice_cup='DEMO-VA-001'`
- Aggiornare `prospect.convertito_cliente_id` per tracciare la conversione.
- Allineare `profiles.ruolo` da `prospect` → `cliente`.

### 2. Seeding dati simulati persistenti (chiaramente marcati come DEMO)
Tutto contrassegnato in `note` con prefisso `[DEMO]` per essere facilmente identificabile/rimovibile e per non inquinare i report finanziari reali. Inoltre `id_legacy='DEMO-VA-...'` sui titoli.

**Polizze (titoli)** — 4-5 polizze rappresentative per un Ente pubblico:
- RC Patrimoniale Amministratori (compagnia: Generali) — premio €18.500, attiva
- All Risks Patrimonio (compagnia: Allianz) — premio €42.000, attiva
- Infortuni dipendenti (compagnia: Generali) — premio €12.300, attiva
- RC Auto parco veicoli (compagnia: Allianz) — premio €28.700, attiva
- Tutela Legale (compagnia: Lloyd's) — premio €6.500, attiva
- Una in scadenza tra 60 giorni per attivare l'alert "prossime scadenze"

Date `durata_da` 2025-01-01 / `durata_a` 2025-12-31, `data_scadenza` distribuite per generare grafici significativi.

**Sinistri** — 4 sinistri per dare sostanza ai grafici e KPI:
- 1 sinistro RC Patrimoniale aperto, riserva €15.000
- 1 sinistro Infortuni dipendente chiuso, liquidato €3.200
- 1 sinistro RC Auto in_lavorazione, riserva €4.800, controparte/targa
- 1 sinistro All Risks chiuso, liquidato €22.000 (danno acqua)

Con `data_evento`, `dinamica`, `luogo_sinistro`, `numero_sinistro`, importi, riserve.

**Documenti demo** in `documenti` (cartella cliente):
- 2 PDF placeholder (polizza-rc.pdf, condizioni-allianz.pdf) — solo metadati riga DB, file fittizio (path storage simulato) oppure usando un blob mini.
- Decisione: solo righe in tabella `documenti` con metadati, senza upload effettivo (non serve per demo visiva del listing).

### 3. Verifica
- Logout demo, login con `protocollo@comune.it` / `Leone123!`
- AuthGuard ora redirige a `/cliente` (non più `/prospect`)
- Verificare visivamente: Dashboard con KPI, grafici premi per ramo, sinistri aperti/chiusi, scadenze in evidenza
- Verificare tab Sinistri con tabella espandibile, grafici Pie + Bar
- Verificare tab Polizze, Documenti, Pagamenti

### 4. Memoria
Aggiungere memoria `mem://demo/comune-varese-ente` con:
- credenziali demo
- elenco ID polizze/sinistri seedati (per non confonderli con dati reali)
- regola: escludere `id_legacy LIKE 'DEMO-VA-%'` dai report finanziari reali se necessario

## Specifiche tecniche

### Migration / Insert SQL (in un'unica edge function temporanea o SQL di seed)
```sql
-- 1. Cliente ente
INSERT INTO clienti (id, tipo_cliente, ragione_sociale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, indirizzo_sede, cap_sede, citta_sede, provincia_sede,
  pec, telefono, email, ufficio_id, user_id, codice_cup, attivo, codice_ricerca, note)
VALUES (gen_random_uuid(), 'ente', 'Comune di Varese', '00441340120', '00441340120',
  'Ente Pubblico', 'Via Sacco 5', '21100', 'Varese', 'VA',
  'protocollo@comune.varese.it', '0332 255111', 'protocollo@comune.it',
  '327e92f7-64f0-48b9-9e48-73611d8cb406', '746c540d-7e65-417d-9834-39612c13213a',
  'DEMO-VA-001', true, 'COMUNE_VARESE', '[DEMO] Utenza demo ente per portale cliente');

-- 2. Update prospect.convertito_cliente_id
UPDATE prospect SET convertito_cliente_id = <new_cliente_id>
WHERE id = '68178b0a-6fd9-41cf-a74a-f09a91a5d5d4';

-- 3. Profile role → cliente
UPDATE profiles SET ruolo='cliente' WHERE id='746c540d-...';

-- 4. Seed titoli (5 polizze) e sinistri (4)
INSERT INTO titoli (...) VALUES (...);
INSERT INTO sinistri (...) VALUES (...);
```

### Compagnie utilizzate (id reali)
- Generali: `3b7d5b9e-f8eb-439c-a1cd-c38789f49d1f`
- Allianz: `2d21455d-ab46-480a-bf01-4f21fda9b6d0`
- Lloyd's: `9bd1eeb8-9c2f-4f9e-8ba4-ad7d5d527f3f`

### Rami utilizzati
- RC Inquinamento `DI`, Incendio Civile `LC`, Infortuni Cumulativa `NC`, RC Auto (cercherò un codice RCA), Tutela Legale (LE/Tutela Giudiziaria — verifico durante l'esecuzione).

## Note
- I dati simulati sono **necessari per la demo** richiesta esplicitamente dall'utente; sono marcati `[DEMO]` e con `id_legacy='DEMO-VA-*'` per essere esclusi dai report reali se servisse. Non violano la regola "no fake data nei report" perché il cliente è un ente demo isolato.
- Nessuna modifica al codice front-end: il portale `/cliente` è già funzionante, basta avere i dati collegati via `clienti.user_id`.
