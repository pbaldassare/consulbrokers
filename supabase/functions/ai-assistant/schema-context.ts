// Schema sintetico esposto al modello.
// Solo le tabelle/viste utili per rispondere a domande operative.
// Le query vengono comunque filtrate dalle policy RLS lato DB.

export const SCHEMA_CONTEXT = `
# Schema database (PostgreSQL via Supabase, schema "public")

REGOLE GENERALI
- "Sede" nell'interfaccia = colonna "ufficio_id" / tabella "uffici" (nome_ufficio).
- Tutte le query vengono eseguite con la sessione dell'utente: vedi solo ciò che ti è permesso.
- Limita sempre i risultati con LIMIT (max 50). Usa ORDER BY per le date più rilevanti.
- Per i nomi di clienti/persone usa ILIKE '%termine%'. Aggrega o filtra prima di restituire.
- Date in formato ISO (YYYY-MM-DD).

## clienti
Anagrafica clienti (privati, aziende, enti).
Colonne utili: id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva, email,
telefono, cellulare, citta_residenza, citta_sede, ufficio_id, tipo_cliente, attivo, stato_cliente.
Per il "nome visibile" usa: COALESCE(ragione_sociale, NULLIF(TRIM(cognome||' '||nome),''), email).

## v_portafoglio_titoli  (vista principale per le polizze)
Una riga per polizza/titolo. Usa SEMPRE questa vista invece di "titoli" quando devi mostrare polizze.
Colonne utili: id, numero_titolo, stato (attivo|sospeso|scaduto|annullato), data_decorrenza,
data_scadenza, data_scadenza_rata, premio_lordo, importo_incassato, data_incasso,
cliente_anagrafica_id, cliente_nome_display, compagnia_id, compagnia_nome,
ramo_id, ramo_descrizione, ufficio_id, ufficio_nome, produttore_nome.

## titoli
Tabella sorgente delle polizze. Usala solo per JOIN avanzati. Per visualizzazioni usa v_portafoglio_titoli.

## sinistri
Colonne utili: id, numero_sinistro, data_sinistro, data_apertura, data_chiusura, stato,
descrizione, costo_previsto, costo_pagato, cliente_id, compagnia_id, titolo_id, ufficio_id,
responsabile_id.

## compagnie
id, nome, codice, partita_iva, attiva, gruppo_compagnia.

## rami
id, codice, descrizione, gruppo (es. "RCA","INFORTUNI","INCENDIO"...).

## uffici
id, nome_ufficio, citta, attivo.

## profiles
Utenti interni. id, nome, cognome, email, ruolo, ufficio_id, attivo.

## trattative
id, titolo, stato (aperta|contatto|preventivo|in_negoziazione|chiuso_vinto|chiuso_perso),
priorita, valore_stimato, data_apertura, data_prossima_azione, cliente_id, prospect_id,
ufficio_id, responsabile_id.

## prospect
id, nome, cognome, ragione_sociale, email, telefono, stato, ufficio_id.

## provvigioni_generate
id, titolo_id, user_id, importo_provvigione, percentuale, calcolata_il, pagata.

## movimenti_contabili
id, data_movimento, tipo (entrata|uscita), importo, categoria, descrizione, ufficio_id,
riferimento_id, riferimento_tipo, stato.

## notifiche
id, user_id, titolo, messaggio, tipo, priorita, letto, created_at.

ESEMPI DI QUERY
- Polizze in scadenza nei prossimi 60 giorni:
  SELECT numero_titolo, cliente_nome_display, compagnia_nome, data_scadenza
  FROM v_portafoglio_titoli
  WHERE data_scadenza BETWEEN CURRENT_DATE AND CURRENT_DATE + 60
    AND stato = 'attivo'
  ORDER BY data_scadenza ASC LIMIT 50;

- Polizza di un cliente specifico:
  SELECT numero_titolo, compagnia_nome, ramo_descrizione, data_decorrenza, data_scadenza, stato
  FROM v_portafoglio_titoli
  WHERE cliente_nome_display ILIKE '%santa marina%'
  ORDER BY data_scadenza DESC LIMIT 20;

- Sinistri aperti del mio ufficio:
  SELECT numero_sinistro, data_sinistro, stato, descrizione
  FROM sinistri
  WHERE stato NOT IN ('chiuso','liquidato')
  ORDER BY data_apertura DESC LIMIT 50;

- Provvigioni di un mese:
  SELECT SUM(importo_provvigione) AS totale, COUNT(*) AS num
  FROM provvigioni_generate
  WHERE calcolata_il >= '2026-04-01' AND calcolata_il < '2026-05-01';
`;
