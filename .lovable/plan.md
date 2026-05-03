## Obiettivo

Implementare nel modulo **E/C Agenzie** la generazione del documento "Estratto Conto Agenzia" con **anteprima**, **download PDF** e **salvataggio in archivio documentale** — esattamente come già fatto per la Precontrattuale.

## Verifica dati DB (già fatta)

Tutti i campi necessari per replicare il modello PDF allegato esistono:

- **Agenzia (`compagnie`)**: nome, codice, indirizzo, cap, comune, provincia, codice_fiscale, partita_iva, iban, intestato_a, mail, mail_ec, pec, percentuale_ra (per Ritenuta d'Acconto)
- **Sede mittente (`uffici`)**: nome_ufficio, indirizzo, cap, citta, provincia, email, telefono — già usata nella Precontrattuale via `profiles.ufficio_id`
- **Titoli (`titoli` + join rami/clienti_anagrafica)**: numero_titolo, riga, appendice, cliente, ramo (codice+descrizione), durata_da/a, premio_lordo, provvigioni_firma+quietanza, tipo_pagamento (per MI), data_messa_cassa
- **Totali**: già calcolati lato pagina (Lordo, Provvigioni, Da Rimettere)

Nessuna migrazione DB necessaria.

## Implementazione

### 1) Libreria PDF — `src/lib/ec-agenzia-pdf.ts`
Stesso pattern di `precontrattuale-pdf.ts` (jsPDF + autotable).

Esporta:
- `buildECAgenziaPdf(data): jsPDF`
- `previewECAgenziaPdf(data)` → blob URL per `<iframe>` o nuova tab
- `downloadECAgenziaPdf(data, filename)` → trigger download
- `uploadECAgenziaPdf(data, params)` → salva su Supabase Storage + crea record in `documenti`

Layout fedele al modello:
```text
[Logo + intestazione Sede]                   [Logo certificazione]
Mail: …
Rif: BENAQ0/250338                Spettabile
                                  AGENZIA NOME
Estratto conto del gg/mm/aaaa     INDIRIZZO
                                  CAP CITTA' PROV
                                  Codice fiscale: …
A saldo delle operazioni effettuate per conto della Vostra Agenzia
per il periodo: <Mese Anno>.
Pagamento a mezzo <Bonifico>
c/c: <IBAN> intestato a <intestato_a>

| Polizza | Cliente/Note | Ramo/Periodo | tp | Premio | Provvigioni | MI |
| …       | …            | …            | …  | …      | …           | …  |
                                  EURO    <Lordo>     <Provv>
                                  Debito/Credito       <Lordo-Provv>
                                  + Ritenuta Acconto   <RA>
                                  A Vostro Credito     <Totale>

[Footer Consulbrokers con sedi]
```

### 2) Pagina dedicata — `src/pages/contabilita/ECAgenziaPdfPage.tsx`
Sulla falsariga di `DocPrecontrattualePage.tsx`:
- Riceve query string: `?compagniaId=…&titoliIds=…&periodoDal=…&periodoAl=…`
- Form modificabile: Riferimento, Data documento, Modalità pagamento, Note finali
- Anteprima live in `<iframe>` con regenerazione su change
- Tre pulsanti azione:
  - **Scarica PDF** → `downloadECAgenziaPdf`
  - **Salva in Archivio** → `uploadECAgenziaPdf` (bucket `documenti`, entità=`compagnia`, `entita_id=compagniaId`)
  - **Invia via mail** → `send-email` edge function con allegato (a `mail_ec` dell'agenzia)
- Logging via `logAttivita({azione:"stampa_ec_agenzia", entita_tipo:"compagnia", entita_id})`

### 3) Integrazione in `ECCompagniaContabPage.tsx`
- Nella riga agenzia espansa, aggiungere bottone **"Stampa E/C"** (icona `FileText`) accanto a "Paga Rimessa"
- Apre `/contabilita/ec-agenzia/pdf?compagniaId=…&titoliIds=…&periodoDal=…&periodoAl=…` (con titoli selezionati o tutti)

### 4) Integrazione in `RimessaDetail.tsx`
- Aggiungere bottone "Scarica E/C PDF" sulla rimessa già creata, leggendo `rimessa_dettaglio.titolo_id` come fonte titoli

### 5) Routing — `src/routes/contabilita.tsx`
- Aggiungere `<Route path="/contabilita/ec-agenzia/pdf" element={<ECAgenziaPdfPage />} />`

### 6) Versione
- Bump `public/version.json`

## File toccati

- nuovo: `src/lib/ec-agenzia-pdf.ts`
- nuovo: `src/pages/contabilita/ECAgenziaPdfPage.tsx`
- modificato: `src/pages/contabilita/ECCompagniaContabPage.tsx`
- modificato: `src/pages/RimessaDetail.tsx`
- modificato: `src/routes/contabilita.tsx`
- modificato: `public/version.json`

## Note

- Riuso completo del pattern Precontrattuale (header sede, footer Consulbrokers, anteprima iframe + download).
- Salvataggio in archivio documentale mantiene tracciabilità storica per ogni E/C generato per agenzia.
- La Ritenuta d'Acconto è calcolata come `provvigioni × compagnie.percentuale_ra` (default 0).
