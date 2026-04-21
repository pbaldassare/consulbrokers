// Schema database esposto al modello AI.
// Le colonne riportate qui sono allineate al DB reale (verificate via information_schema).
// Tutte le query passano da ai_exec_select (SELECT-only) e rispettano RLS dell'utente.

export const SCHEMA_CONTEXT = `
# Schema database (PostgreSQL via Supabase, schema "public")

## REGOLE GENERALI
- Tutte le query vengono eseguite con la sessione dell'utente: vedi solo ciò che le RLS gli permettono.
- Limita SEMPRE i risultati con LIMIT (max 100). Usa ORDER BY per le date più rilevanti.
- Per nomi/testi usa ILIKE '%termine%' (case-insensitive). Prova varianti se non trovi nulla.
- Date in formato ISO (YYYY-MM-DD). Importi in EUR (numeric).
- Per domande aggregate (totali, conteggi, medie) usa SUM/COUNT/AVG/GROUP BY: NON ritornare righe grezze.
- Se non sei sicuro di una colonna, chiama prima il tool "describe_table".
- Per l'utente corrente usa auth.uid().

## ALIASES UI → DB (terminologia interfaccia)
- "Sede" = ufficio (tabella uffici, FK ufficio_id)
- "Specialist" / "Backoffice" = ruolo nel profilo (profiles.ruolo = 'backoffice')
- "Account Executive" / "AE" = ruolo commerciale principale (profiles.ruolo = 'executive', titoli.ae_nome)
- "Consul" / "Produttore" = profiles.ruolo = 'produttore' (titoli.produttore_nome)
- "Commerciale" sulla polizza = anagrafica esterna (titoli.anagrafica_commerciale_id → anagrafiche_professionali)
- "Trattativa" = trattative; "Polizza"/"Titolo" = titoli (vista: v_portafoglio_titoli)

## TABELLE PRINCIPALI

### clienti
Anagrafica clienti (privati, aziende, enti).
Campi chiave: id, tipo_cliente ('privato'|'azienda'|'ente'), tipo_persona, nome, cognome,
ragione_sociale, codice_fiscale, partita_iva, email, pec, telefono, cellulare,
indirizzo_residenza/sede, citta_residenza/sede, provincia_residenza/sede, ufficio_id,
attivo, stato_cliente, gruppo_finanziario_id, settore, attivita, fatturato, num_dipendenti.
Nome visibile: COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email).

### v_portafoglio_titoli (VISTA PRINCIPALE delle polizze)
Una riga per polizza. Usa SEMPRE questa vista invece di "titoli" per visualizzare/filtrare polizze.
Campi: id, numero_titolo, stato ('attivo'|'sospeso'|'scaduto'|'annullato'), data_decorrenza
(durata_da), data_scadenza (durata_a), data_messa_cassa, data_pagamento,
premio_lordo, premio_netto, importo_incassato, data_incasso,
cliente_anagrafica_id, cliente_nome_display, cliente_codice_fiscale, cliente_tipo,
compagnia_id, compagnia_nome, compagnia_codice,
ramo_id, ramo_nome, ramo_codice, gruppo_ramo (es. 'RCA','INFORTUNI'),
ufficio_id, nome_ufficio, produttore_id, produttore_nome, ae_nome, specialist,
tipo_portafoglio, periodicita, rate, tipo_rinnovo, indicizzata, regolazione,
conferimento_gestito, fondi_ricevuti, data_conferimento_gestito,
data_sospensione, data_riattivazione, motivo_sospensione,
sostituisce_polizza, storno_polizza, targa_telaio, vincolo, descrizione_polizza.

### titoli
Tabella sorgente delle polizze (più colonne tecniche di v_portafoglio_titoli).
Usala SOLO per JOIN avanzati (es. con anagrafica_commerciale_id, percentuale_commerciale,
percentuale_riparto, provvigioni_firma, provvigioni_quietanza).

### titoli_movimenti
Storico movimenti polizza (rinnovi, sospensioni, ecc.). Collega titoli nel tempo.

### appendici_polizza
Varianti contrattuali su una polizza.
Campi: id, titolo_id, numero_appendice, data_appendice, data_effetto, oggetto, testo, tipo, file_path.

### sinistri
Campi: id, numero_sinistro, numero_sinistro_compagnia, titolo_id, cliente_id, compagnia_id,
responsabile_id (FK profiles), perito_id, liquidatore_id, ufficio_id, ramo_sinistro,
stato ('aperto'|'in_lavorazione'|'liquidato'|'chiuso'|'respinto'), tipo_sinistro,
data_apertura, data_chiusura, data_evento, data_denuncia, descrizione, dinamica,
costo_preventivato, costo_effettivo, importo_liquidato, importo_riserva, franchigia,
targa_veicolo, controparte, luogo_sinistro, citta_sinistro, provincia_sinistro.

### trattative
Pipeline commerciale (CRM). Una trattativa è collegata a un prospect OPPURE a un cliente esistente.
Campi reali: id, prospect_id (FK prospect), cliente_id (FK clienti), compagnia_id (FK compagnie),
ramo_id (FK rami), ufficio_id (FK uffici),
prodotto (text libero, es. 'RCA Auto','Vita'), sottoprodotto (text), compagnia (text LEGACY: preferire compagnia_id→compagnie.nome),
fonte (text: 'sito','telefono','referral',...),
premio_previsto (numeric), premio_effettivo (numeric, valorizzato a chiusura vinta),
stato ('aperta'|'contatto'|'preventivo'|'in_negoziazione'|'chiuso_vinto'|'chiuso_perso'),
priorita ('bassa'|'media'|'alta'),
data_apertura (date), data_scadenza (date, prossima azione), data_chiusura (date), motivo_chiusura (text),
assegnato_a (FK profiles — NON usare "responsabile_id"!), created_by (FK profiles),
archiviata (boolean, default false), note (text), created_at, updated_at.
Per il nome del contatto usa JOIN: COALESCE(c.ragione_sociale, c.cognome||' '||c.nome,
                                            p.ragione_sociale, p.cognome||' '||p.nome)
con LEFT JOIN clienti c ON c.id=t.cliente_id e LEFT JOIN prospect p ON p.id=t.prospect_id.

### prospect
Contatti commerciali pre-cliente (privati e aziende). Quando convertiti popolano convertito_cliente_id.
Campi reali: id, tipo_cliente ('privato'|'azienda'|'ente'),
nome, cognome, ragione_sociale, codice_fiscale, partita_iva,
email, pec, telefono, cellulare,
indirizzo_residenza, citta_residenza, provincia_residenza, cap_residenza,
indirizzo_sede, citta_sede, provincia_sede, cap_sede,
fonte (text), stato (text libero, filtra con ILIKE),
assegnato_a (FK profiles), ufficio_id (FK uffici),
convertito_cliente_id (FK clienti — IS NOT NULL ⇒ prospect convertito in cliente),
settore, attivita, codice_ateco, fascia_fatturato, fascia_dipendenti,
created_at, updated_at.
Nome visibile: COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email).

### compagnie
Compagnie assicurative. Campi: id, nome, nome_segue, codice, partita_iva, codice_fiscale,
attiva, stato, gruppo_compagnia, gruppo_compagnia_id, tipo_mandatario, tipo_pagamento,
iban, citta_banca, percentuale_ra, mail, pec.

### rami
Rami assicurativi. Campi: id, codice, descrizione, gruppo (es. 'RCA','INFORTUNI','INCENDIO').

### uffici
Sedi. Campi: id, nome_ufficio, citta, attivo.

### profiles
Utenti interni. Campi: id, nome, cognome, email, ruolo
('admin'|'executive'|'backoffice'|'produttore'|'corrispondente'|'cliente'|'prospect'),
ufficio_id, attivo, codice_contabile.

### nominativi_cliente
Referenti multipli per cliente. Campi: id, cliente_id, nome, cognome, email, telefono, ruolo, note.

### anagrafiche_professionali
Anagrafiche esterne (commerciali, periti, liquidatori, fornitori).
Campi: id, tipo, nome, cognome, ragione_sociale, codice_fiscale, partita_iva,
compagnia_id, ufficio_id, percentuale_base, percentuale_consulenza, percentuale_ra, attivo.

### codici_commerciali_cliente
Assegnazioni commerciali su cliente.
Campi: id, cliente_id, ruolo (es. 'AE','specialist','consul'), profilo_id (FK profiles),
percentuale, mandato, data_acquisito, scadenza_mandato, data_disdetta, altro_broker.

### provvigioni_generate
Calcolo provvigioni per polizza/utente.
Campi: id, titolo_id, user_id (FK profiles), tipo_destinatario ('produttore'|'commerciale'|'sede'),
percentuale, importo_provvigione, calcolata_il, pagata.

### pagamenti_provvigioni
Distinte pagamento provvigioni.
Campi: id, ufficio_id, pagato_a_user_id, periodo_da, periodo_a, totale_importo,
metodo, riferimento, note, creato_da.

### movimenti_contabili
Cassa per ufficio.
Campi: id, ufficio_id, tipo ('entrata'|'uscita'), categoria, importo, data_movimento,
descrizione, riferimento_tipo, riferimento_id, stato, iva_aliquota, iva_imponibile, iva_importo.

### rimesse / rimesse_righe
Rimesse alle compagnie (sintetico — usa describe_table per dettagli).

### notifiche
Campi: id, destinatario_id (FK profiles, NON "user_id"!), ufficio_id, tipo, titolo,
messaggio, entita_tipo, entita_id, priorita, letto, created_at.

### log_attivita
Audit log. Campi: id, user_id, azione, entita_tipo, entita_id, dettagli_json, ufficio_id, severity.

## GLOSSARIO STATI
- titoli.stato: 'attivo' | 'sospeso' | 'scaduto' | 'annullato'
- sinistri.stato: 'aperto' | 'in_lavorazione' | 'liquidato' | 'chiuso' | 'respinto'
- trattative.stato: 'aperta' | 'contatto' | 'preventivo' | 'in_negoziazione' | 'chiuso_vinto' | 'chiuso_perso'
- clienti.stato_cliente / prospect.stato: testuale libero (filtra con ILIKE).

## ESEMPI DI QUERY UTILI

-- Quante trattative ho aperte (assegnate a me):
SELECT COUNT(*) AS aperte
FROM trattative
WHERE assegnato_a = auth.uid()
  AND stato NOT IN ('chiuso_vinto','chiuso_perso')
  AND COALESCE(archiviata,false) = false;

-- Trattative aperte raggruppate per stato:
SELECT stato, COUNT(*) AS num, SUM(premio_previsto) AS premio_totale
FROM trattative
WHERE COALESCE(archiviata,false) = false
GROUP BY stato ORDER BY num DESC;

-- Polizze in scadenza nei prossimi 30 giorni:
SELECT numero_titolo, cliente_nome_display, compagnia_nome, ramo_nome, data_scadenza, premio_lordo
FROM v_portafoglio_titoli
WHERE data_scadenza BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
  AND stato = 'attivo'
ORDER BY data_scadenza ASC LIMIT 100;

-- Polizze RCA in scadenza per cliente specifico:
SELECT numero_titolo, compagnia_nome, data_scadenza, premio_lordo, targa_telaio
FROM v_portafoglio_titoli
WHERE cliente_nome_display ILIKE '%rossi%'
  AND gruppo_ramo = 'RCA'
  AND stato = 'attivo'
ORDER BY data_scadenza ASC LIMIT 50;

-- Top 10 clienti per premio totale anno corrente:
SELECT cliente_nome_display, COUNT(*) AS num_polizze, SUM(premio_lordo) AS premio_tot
FROM v_portafoglio_titoli
WHERE EXTRACT(YEAR FROM data_decorrenza) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY cliente_nome_display
ORDER BY premio_tot DESC NULLS LAST LIMIT 10;

-- Premi totali per compagnia ultimo trimestre:
SELECT compagnia_nome, COUNT(*) AS polizze, SUM(premio_lordo) AS premio
FROM v_portafoglio_titoli
WHERE data_decorrenza >= date_trunc('quarter', CURRENT_DATE)
GROUP BY compagnia_nome
ORDER BY premio DESC LIMIT 20;

-- Sinistri aperti con riserva > 0:
SELECT numero_sinistro, data_apertura, importo_riserva, importo_liquidato,
       (SELECT cliente_nome_display FROM v_portafoglio_titoli v WHERE v.id = s.titolo_id) AS cliente
FROM sinistri s
WHERE stato IN ('aperto','in_lavorazione')
  AND COALESCE(importo_riserva,0) > 0
ORDER BY importo_riserva DESC LIMIT 50;

-- Polizze sospese da riattivare:
SELECT numero_titolo, cliente_nome_display, data_sospensione, motivo_sospensione
FROM v_portafoglio_titoli
WHERE stato = 'sospeso'
ORDER BY data_sospensione DESC LIMIT 50;

-- Provvigioni mie maturate ma non pagate:
SELECT SUM(importo_provvigione) AS totale, COUNT(*) AS num
FROM provvigioni_generate
WHERE user_id = auth.uid() AND pagata = false;

-- Provvigioni pagate vs maturate ultimo mese:
SELECT pagata, SUM(importo_provvigione) AS totale, COUNT(*) AS num
FROM provvigioni_generate
WHERE calcolata_il >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
  AND calcolata_il < date_trunc('month', CURRENT_DATE)
GROUP BY pagata;

-- Polizze in conferimento gestito non ancora liquidate dalla compagnia:
SELECT numero_titolo, cliente_nome_display, compagnia_nome, premio_lordo, data_conferimento_gestito
FROM v_portafoglio_titoli
WHERE conferimento_gestito = true AND COALESCE(fondi_ricevuti, false) = false
ORDER BY data_conferimento_gestito ASC LIMIT 50;

-- Cassa entrate del mese corrente per ufficio:
SELECT ufficio_id, SUM(importo) AS entrate
FROM movimenti_contabili
WHERE tipo = 'entrata' AND data_movimento >= date_trunc('month', CURRENT_DATE)
GROUP BY ufficio_id;

-- ============== TRATTATIVE & PROSPECT ==============

-- Pipeline trattative per stato (totali e premio):
SELECT stato, COUNT(*) AS num,
       SUM(premio_previsto) AS premio_previsto,
       SUM(premio_effettivo) AS premio_effettivo
FROM trattative
WHERE COALESCE(archiviata,false) = false
GROUP BY stato ORDER BY num DESC;

-- Le mie trattative aperte ordinate per scadenza (con nome contatto):
SELECT t.id,
       COALESCE(c.ragione_sociale, c.cognome||' '||c.nome,
                p.ragione_sociale, p.cognome||' '||p.nome) AS contatto,
       t.prodotto, t.stato, t.priorita, t.data_scadenza, t.premio_previsto
FROM trattative t
LEFT JOIN clienti c ON c.id = t.cliente_id
LEFT JOIN prospect p ON p.id = t.prospect_id
WHERE t.assegnato_a = auth.uid()
  AND t.stato NOT IN ('chiuso_vinto','chiuso_perso')
  AND COALESCE(t.archiviata,false) = false
ORDER BY t.data_scadenza ASC NULLS LAST LIMIT 50;

-- Trattative chiuse vinte ultimo trimestre con premio mensile:
SELECT date_trunc('month', data_chiusura) AS mese,
       COUNT(*) AS vinte,
       SUM(premio_effettivo) AS premio
FROM trattative
WHERE stato = 'chiuso_vinto'
  AND data_chiusura >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY 1 ORDER BY 1;

-- Conversion rate (win rate) trattative per ufficio (ultimo anno):
SELECT u.nome_ufficio,
       COUNT(*) FILTER (WHERE t.stato='chiuso_vinto') AS vinte,
       COUNT(*) FILTER (WHERE t.stato='chiuso_perso') AS perse,
       ROUND(100.0 * COUNT(*) FILTER (WHERE t.stato='chiuso_vinto')
            / NULLIF(COUNT(*) FILTER (WHERE t.stato IN ('chiuso_vinto','chiuso_perso')),0), 1) AS win_rate_pct
FROM trattative t
LEFT JOIN uffici u ON u.id = t.ufficio_id
WHERE t.data_chiusura >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY u.nome_ufficio
ORDER BY win_rate_pct DESC NULLS LAST;

-- Prospect aperti per fonte:
SELECT fonte, COUNT(*) AS num
FROM prospect
WHERE convertito_cliente_id IS NULL
GROUP BY fonte ORDER BY num DESC;

-- Miei prospect non convertiti più vecchi di 30 giorni (da risollecitare):
SELECT id,
       COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email) AS nominativo,
       fonte, stato, created_at
FROM prospect
WHERE assegnato_a = auth.uid()
  AND convertito_cliente_id IS NULL
  AND created_at < NOW() - INTERVAL '30 days'
ORDER BY created_at ASC LIMIT 50;

-- Prospect convertiti in cliente quest'anno con prima polizza:
SELECT p.id AS prospect_id,
       COALESCE(p.ragione_sociale, p.cognome||' '||p.nome) AS contatto,
       p.convertito_cliente_id,
       MIN(v.data_decorrenza) AS prima_polizza,
       COUNT(v.id) AS num_polizze
FROM prospect p
LEFT JOIN v_portafoglio_titoli v ON v.cliente_anagrafica_id = p.convertito_cliente_id
WHERE p.convertito_cliente_id IS NOT NULL
  AND EXTRACT(YEAR FROM p.updated_at) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY p.id, p.ragione_sociale, p.cognome, p.nome, p.convertito_cliente_id
ORDER BY prima_polizza DESC NULLS LAST LIMIT 30;

-- Prospect non convertiti per ufficio (es. "sede di Milano"):
SELECT u.nome_ufficio, COUNT(*) AS prospect_aperti
FROM prospect p
LEFT JOIN uffici u ON u.id = p.ufficio_id
WHERE p.convertito_cliente_id IS NULL
  AND u.nome_ufficio ILIKE '%milano%'
GROUP BY u.nome_ufficio;
`;
