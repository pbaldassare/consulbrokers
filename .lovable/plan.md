## Obiettivo
Il **Codice CIG** deve esistere solo a livello di **polizza/quietanza** e solo quando il **cliente è un Ente**. Va rimosso dall'anagrafica cliente e nascosto in polizza/quietanza per linea Persona o Azienda.

## Modifiche

### 1. `src/pages/ClienteDetail.tsx` — rimuovere CIG dall'anagrafica
- Eliminare il `FieldInput` "Codice CIG" (righe ~2223-2230) nella sezione Azienda/Ente.
- Rimuovere dalla `requiredFieldsList` la riga (~1741) che aggiunge `codice_cig` come obbligatorio per Ente, così l'indicatore "campi mancanti" non lo richiede più.
- Lasciare invariata la colonna DB `clienti.codice_cig` (i dati esistenti restano, semplicemente non si modificano più da qui).

### 2. `src/pages/ImmissionePolizzaPage.tsx` — CIG solo se Ente
Oggi il campo CIG è sempre visibile e diventa solo "obbligatorio" se Ente. Cambiare in: **mostrare il blocco CIG (input + checkbox "CIG temporaneo" + errori) solo quando `tipoSoggetto === "ente"`**.
- Wrappare il blocco UI ~righe 1893-1920 in `{tipoSoggetto === "ente" && (...)}`.
- Sul submit, forzare `cig_rif = null` e `cig_temporaneo = false` quando il cliente non è Ente (righe ~1294-1295), così non si salvano residui legacy se l'utente cambia cliente dopo aver scritto qualcosa.
- La validazione `cigObbligatorio`/`cigValido` (righe ~736-747) resta com'è: per non-Ente non c'è campo, quindi non blocca mai.

### 3. `src/pages/TitoloDetail.tsx` — CIG/Rif solo se Ente
Stessa logica in dettaglio titolo:
- Calcolare `isEnte` dal cliente collegato al titolo (via `t.cliente_anagrafica.gruppi_finanziari?.tipo_soggetto === "ente"`, già letto in pagina).
- Nascondere `<FieldRow label="CIG/Rif." ...>` (riga 2030) se non Ente.
- Nascondere il blocco edit CIG/Rif (righe 2137-2144) se non Ente.

### 4. Test rapidi post-modifica
- Aprire un cliente Privato/Azienda: nessun campo CIG in anagrafica, in nuova polizza, in dettaglio titolo.
- Aprire/creare cliente Ente (es. "Comune di Santa Marina Salina" in screenshot): CIG visibile solo in immissione polizza e in TitoloDetail, obbligatorio in immissione.

## Cosa NON tocchiamo
- Schema DB (`clienti.codice_cig`, `titoli.cig_rif`, `titoli.cig_temporaneo`, `clienti.cig_temporaneo`): conservati per i dati storici e per la pagina di immissione/quietanza.
- Helper `src/lib/validateCig.ts` e il flag "CIG temporaneo" lato polizza: invariati.
- `NuovoClienteDialog`: non mostra già il campo CIG, nessuna modifica necessaria.
- Memoria `mem://insurance/cig-validation-and-temp-flag.md`: andrà aggiornata in fase di build mode per riflettere "CIG solo a livello polizza, mai in anagrafica cliente".
