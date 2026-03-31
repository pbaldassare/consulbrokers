

## Piano: Fix Edge Function + Esecuzione diretta import + Rimozione pulsante

### Analisi Excel — 40 colonne, ~549 record

Le colonne dell'Excel e il loro mapping:

**Campi → tabella `clienti` (TUTTI GIA ESISTENTI)**

| Colonna Excel | Campo DB | Note |
|---|---|---|
| Codice | `codice_ricerca` | Padded a 6 cifre (es. "000032") |
| Nome | `ragione_sociale` se G, oppure split `cognome`+`nome` se F | Split su primo spazio |
| F/G | `tipo_cliente` | F=privato, G=azienda |
| Indirizzo | `indirizzo_residenza` (F) / `indirizzo_sede` (G) | |
| Cap | `cap_residenza` / `cap_sede` | |
| Comune | `citta_residenza` / `citta_sede` | |
| Prov | `provincia_residenza` / `provincia_sede` | |
| Tel | `telefono` | |
| Email | `email` | |
| AttenDi | `attenzione_di` | |
| CF | `codice_fiscale` (F) / `codice_fiscale_azienda` (G) | |
| PIva | `partita_iva` | |
| GruStat | `gruppo_statistico` | Testo libero, es. "Gruppo CAREMAR" |
| GruFin | `gruppo_finanziario_id` | Lookup per nome → `gruppi_finanziari.id`, crea se mancante |
| Indotto | `indotto` | Testo, es. "Gruppo CAREMAR", "PERSONE FISICHE" |
| Zona | `zona` | "SUD", "CENTRO", "NORD-OVEST" — gia in `lookup_zone` |
| Attivita | `attivita` | "CATEGORIA DA DEFINIRE" ecc. |
| Fatturato | `fatturato` | Spesso vuoto |
| Dipendenti | `fascia_dipendenti` | Spesso vuoto |
| SpecialistSX | `spec_sx_danni` | Es. "BONITO TINA" |
| Stato | `attivo` + `stato_cliente` | "Attivo" / "non attivo" |

**Campi → tabella `codici_commerciali_cliente` (GIA ESISTENTE, da popolare)**

| Colonna Excel | Campo DB | Note |
|---|---|---|
| Brand | `societa_brand` | Sempre "Consulbrokers" (a volte vuoto negli ultimi record) |
| Unit | `filiale` | "SEDE NAPOLI" o "SEDE ROMA" |
| Specialist | ruolo `Backoffice`, `profilo_id` → `profiles` | GUARRACINO, SCARPELLI, DEL GIUDICE, BOCCHINI |
| Prod1 | ruolo `corrispondente_1`, **`profilo_id` = null**, `contatto` = nome | AMATO MARCELLINO, BRIGIDA ecc. |
| Prod2 | ruolo `corrispondente_2`, `profilo_id` = null | |
| Prod3 | ruolo `corrispondente_3`, `profilo_id` = null | "Consulbrokers Digital Srl" ecc. |
| Acquisito | `data_acquisito` | Date in formato MM/DD/YY |
| ScadMandato | `scadenza_mandato` | |
| Filiale | non usato separatamente | Corrisponde a "Ufficio di Napoli" = `ufficio_id` |

**Colonne ignorate** (non servono per l'import):
CF dup, PI dup, Inserito, Variato, Ultimo carico, Pr Scad, 7A Invio, 7A Reso, 7A Evaso, GDPR Evaso

### Bug critico da fixare

Nella Edge Function `import-clienti`, righe 226-260: per `Prod1/2/3` viene assegnato `profilo_id` cercando in `anagrafiche_professionali`, ma la FK `codici_commerciali_cliente.profilo_id` punta a `profiles`. I corrispondenti non hanno un record in `profiles`, quindi causa errore di FK violation.

**Fix**: per `corrispondente_1/2/3` impostare `profilo_id: null` e salvare il nome solo in `contatto`.

### Cosa faremo (3 step)

**1. Fix Edge Function `import-clienti/index.ts`**
- Righe 228, 240, 252: cambiare `profilo_id: anagMap[prodKey] || null` → `profilo_id: null`
- I produttori restano referenziati solo per nome nel campo `contatto`

**2. Eseguire l'import direttamente**
- Parsare l'Excel `Clienti_Napoli-2.xlsx` tramite script
- Chiamare la Edge Function con `action: "replace_all"`, passando `clienti` e `codici_commerciali`
- Risultato atteso: ~549 clienti inseriti, codici commerciali creati, gruppi finanziari mancanti creati automaticamente

**3. Rimuovere la card "Reimporta Clienti Napoli" da ManutenzionePage**
- Eliminare righe 284-317 (card con upload Excel)
- Rimuovere: `importClienti` mutation (righe ~93-169), `handleFileUpload` (righe 171-180), `fileInputRef`, `importStatus`, `parseExcelDate`, import `Upload`/`Database`
- Togliere `importClienti.isPending` da `isAnyRunning`

### File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/import-clienti/index.ts` | Fix: `profilo_id: null` per Prod1/2/3 |
| `src/pages/ManutenzionePage.tsx` | Rimozione card + codice import |
| Script diretto | Parsing Excel + invocazione Edge Function |

