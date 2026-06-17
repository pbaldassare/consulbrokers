## Cosa ho capito

Oggi `titoli.regolazione` è un **boolean** statico, mostrato come "No/Sì" nella sezione "Regolazione" della pagina titolo. Tu lo vuoi trasformare in un **promemoria operativo**: quando la polizza è "in regolazione" devo sapere **quando** andrà fatta e **su che base** (fatturato, numero dipendenti, ecc.), e voglio una **card in Gestione Polizze** che mi elenchi tutti i titoli flaggati — stessa UX della card "CIG Temporanei".

NB: la tabella `titoli_regolazioni` esistente serve a un'altra cosa (registra la regolazione **già eseguita** con consuntivo/conguaglio, generando un titolo figlio). Quella resta com'è. Qui aggiungiamo i **parametri della regolazione attesa** direttamente sul titolo madre.

## Piano

### 1. Database (migration)
Su `titoli`:
- `regolazione_data_presunta DATE` — quando va fatta
- `regolazione_fattore TEXT` con CHECK in `('fatturato','num_dipendenti','retribuzioni','altro')`
- `regolazione_note TEXT` — campo libero opzionale
- Indice parziale `idx_titoli_regolazione_flag` su `WHERE regolazione = true`

Il boolean `titoli.regolazione` resta la verità del flag (così non rompiamo nulla). Quando il flag passa a `false`, i tre campi vengono azzerati lato UI in submit.

### 2. UI — sezione "Regolazione" in `TitoloDetail`
La riga statica `Regolazione: No` diventa:
- Header con **Switch** "Polizza in regolazione" (scrive `titoli.regolazione`)
- Quando ON, mostra inline: **Data presunta** (DatePicker), **Fattore** (SearchableSelect con le 4 voci sopra), **Note**, e mantiene `Periodicità` / `Tipo Lettera` già presenti.
- Pulsante "Modifica" apre lo stesso pannello in edit (coerente con le altre sezioni). Il modale dedicato non serve: usiamo il pattern già adottato dalle altre sezioni (collapsible + edit inline) per non rompere il look & feel.
- Lock attivo se `data_messa_cassa` o stato `incassato`/`stornato` (regola standard `TitoloDetail`).

> Se preferisci esplicitamente un modale separato invece dell'edit inline, dimmelo e cambio approccio: l'ho proposto inline solo per coerenza con Contratto/Periodo/Importi.

### 3. Card in `/portafoglio/gestione`
Aggiungo la **13ª/14ª operazione** "Regolazioni Attese" accanto a "CIG Temporanei":
- Icona `FileClock`, badge ambra live con il conteggio di `titoli` con `regolazione=true` (escluse polizze chiuse).
- Al click filtra la lista risultati su `regolazione=true` (stessa logica multi-step già usata per CIG: query su `titoli` per id → join con `v_portafoglio_titoli`).
- "Esegui" apre `TitoloDetail` con la sezione Regolazione già espansa (`?section=regolazione`).
- Colonna extra in tabella: badge "Reg. attesa" + `regolazione_data_presunta` formattata; ordinamento per data presunta crescente di default su questa operazione.

### 4. Filtro segmentato Regolazione
Come per il CIG: tre-stati **Tutti / Con Regolazione / Senza Regolazione** nella sezione filtri, nascosto quando l'operazione attiva è già "Regolazioni Attese". Persistenza in URL come `reg=`.

### 5. Filtro Scaduta / In scadenza
Nella card "Regolazioni Attese" badge automatici sulla riga:
- 🔴 **Scaduta** se `regolazione_data_presunta < today`
- 🟡 **In scadenza** se entro 30 gg
- ⚪ **Programmata** altrimenti

### 6. Memory
Creo `mem://insurance/regolazione-reminder-flag.md` con: campi DB, semantica del flag vs `titoli_regolazioni`, valori validi di `regolazione_fattore`, regola della card in Gestione Polizze.

## File toccati (stima)
- **Migration nuova** su `titoli` (3 colonne + indice)
- `src/pages/TitoloDetail.tsx` — sezione Regolazione rivista
- `src/pages/GestionePolizzePage.tsx` — nuova operazione + filtro segmentato + colonna
- `src/components/polizze/RegolazioneSection.tsx` (nuovo) — incapsula il blocco
- `.lovable/memory/insurance/regolazione-reminder-flag.md` (nuovo)

## Cosa NON tocco
- `titoli_regolazioni` (resta per la regolazione **eseguita** con conguaglio)
- Logica messa a cassa / cascade annullamento
- `tipo_lettera_regolazione` e `periodicita` (restano dove sono, in sezione Regolazione)
