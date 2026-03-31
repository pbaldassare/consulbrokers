

## Analisi: Campi già esistenti nel DB

Hai ragione a chiedere — **quasi tutti i campi sono già presenti** nella tabella `clienti`. Ecco il mapping completo:

### Campi Excel → Campi DB `clienti` (GIÀ ESISTENTI)

| Colonna Excel | Campo DB `clienti` | Stato |
|---|---|---|
| Codice | `codice_ricerca` | ✅ Esiste |
| Nome | `cognome`/`nome` (F) o `ragione_sociale` (G) | ✅ Esiste |
| F/G | `tipo_cliente` (privato/azienda) | ✅ Esiste |
| Indirizzo | `indirizzo_residenza` (F) / `indirizzo_sede` (G) | ✅ Esiste |
| Cap | `cap_residenza` / `cap_sede` | ✅ Esiste |
| Comune | `citta_residenza` / `citta_sede` | ✅ Esiste |
| Prov | `provincia_residenza` / `provincia_sede` | ✅ Esiste |
| Tel | `telefono` | ✅ Esiste |
| Email | `email` | ✅ Esiste |
| AttenDi | `attenzione_di` | ✅ Esiste |
| CF | `codice_fiscale` (F) / `codice_fiscale_azienda` (G) | ✅ Esiste |
| PIva | `partita_iva` | ✅ Esiste |
| GruStat | `gruppo_statistico` | ✅ Esiste (testo, lookup in `gruppi_statistici`) |
| GruFin | `gruppo_finanziario_id` | ✅ Esiste (FK → `gruppi_finanziari`) |
| Indotto | `indotto` | ✅ Esiste (testo, lookup in `lookup_indotti`) |
| Zona | `zona` | ✅ Esiste (testo, lookup in `lookup_zone`) |
| Attivita | `attivita` | ✅ Esiste (testo, lookup in `lookup_attivita`) |
| SpecialistSX | `spec_sx_danni` | ✅ Esiste |
| Stato | `attivo` / `stato_cliente` | ✅ Esiste |
| Fatturato | `fatturato` | ✅ Esiste |
| Dipendenti | `fascia_dipendenti` | ✅ Esiste |

### Campi Excel → Tabella `codici_commerciali_cliente` (GIÀ ESISTENTE)

| Colonna Excel | Campo DB | Stato |
|---|---|---|
| Brand | `societa_brand` | ✅ Esiste (= "Consulbrokers" sempre) |
| Unit / Filiale | `filiale` | ✅ Esiste |
| Specialist | `ruolo = 'Backoffice'`, `profilo_id` → profiles | ✅ Esiste |
| Prod1 | `ruolo = 'corrispondente_1'`, `profilo_id` → anagrafiche | ✅ Esiste |
| Prod2 | `ruolo = 'corrispondente_2'` | ✅ Esiste |
| Prod3 | `ruolo = 'corrispondente_3'` | ✅ Esiste |
| Acquisito | `data_acquisito` | ✅ Esiste |
| ScadMandato | `scadenza_mandato` | ✅ Esiste |

### Nota su "Brand" = Sede

Hai ragione: **Brand = "Consulbrokers"** per tutti i record, e **Unit = "SEDE NAPOLI" o "SEDE ROMA"** corrisponde alla sede/filiale. Il campo `ufficio_id` è già collegato a `uffici` (`f5163c49...` = "Ufficio di Napoli"). Il campo `filiale` in `codici_commerciali_cliente` può ospitare "SEDE NAPOLI" / "SEDE ROMA".

### Tabelle di lookup già presenti

- `lookup_zone`: 13 record (SUD, CENTRO, NORD-OVEST, ecc.) ✅
- `lookup_indotti`: 3 record ✅
- `lookup_attivita`: 20+ record ✅
- `gruppi_statistici`: 16 record ✅
- `gruppi_finanziari`: 21+ record ✅ (ma alcuni valori Excel mancano, vanno creati)

### Cosa manca nel DB

1. **Gruppi finanziari mancanti**: alcuni valori dall'Excel non esistono ancora (es: "Gruppo CAREMAR", "GRUPPO EUROELETTRICA IMPIANTI", "Gruppo CALCIATORI SINGOLI", "Gruppo Dipendenti FIME", "Gruppo Dipendenti Società PERRETTI", "Gestione Milano", "PERSONE FISICHE")
2. **Profiles Specialist mancanti**: nel DB ci sono solo GUARRACINO come backoffice. Mancano: SCARPELLI PAOLA, DEL GIUDICE PALMINA, BOCCHINI SERENA, BONITO TINA — vanno creati come profiles con ruolo `backoffice`
3. **Dati nei codici_commerciali_cliente**: la tabella è vuota, va popolata

### Piano di implementazione

**Non serve creare nuove tabelle né nuove colonne.** Serve solo:

1. **Creare i gruppi finanziari mancanti** (INSERT in `gruppi_finanziari`)
2. **Creare i profiles Specialist mancanti** (SCARPELLI, DEL GIUDICE, BOCCHINI, BONITO) con ruolo `backoffice`
3. **Aggiornare la Edge Function `import-clienti`** con action `replace_all`:
   - Cancella `codici_commerciali_cliente` e `clienti_relazioni` esistenti
   - Cancella tutti i clienti
   - Reinserisce i ~548 clienti con tutti i campi mappati
   - Per ogni cliente crea i record `codici_commerciali_cliente` (Specialist, Prod1/2/3)
   - Risolve GruFin per nome → `gruppo_finanziario_id`
   - Risolve Specialist per cognome/nome → `profilo_id` in profiles
   - Risolve Prod1/2/3 per nome → `profilo_id` in anagrafiche_professionali
4. **Aggiornare ManutenzionePage** con bottone "Reimporta Clienti Napoli" che parsa l'Excel e invoca la function

### File coinvolti

| Azione | File |
|---|---|
| Modifica | `supabase/functions/import-clienti/index.ts` — nuova action `replace_all` |
| Modifica | `src/pages/ManutenzionePage.tsx` — bottone reimportazione con upload Excel |
| Dati | INSERT profiles Specialist mancanti + INSERT gruppi_finanziari mancanti (via Edge Function) |

