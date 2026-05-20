## Obiettivo

Snellire la dialog "Nuovo/Modifica Rapporto" in `RapportiCompagniaDialog.tsx`: in vista solo l'essenziale per salvare, tutto il resto collassato.

## Campi sempre visibili (obbligatori, con `*`)

1. **Nome rapporto**
2. **Compagnia Assicurativa**
3. **Rami e Sottorami abilitati** — almeno una riga valida (gruppo selezionato + "Tutti" o ≥1 sottoramo)
4. **IBAN** del conto rapporto (validato mod-97)
5. **Intestatario** del conto (default: nome rapporto se vuoto)

Bottone **Salva Rapporto** disabilitato finché 1–5 non sono validi.

## Campi nascosti dietro toggle "Mostra altri dettagli"

Tutto il resto, raggruppato:

- **Dati rapporto**: Codice, Tipo, Data Inizio, Data Fine, % Provvigione, Attivo
- **Conto bancario (extra)**: Etichetta, Banca, BIC, ABI, CAB, Note conto
- **Sede del rapporto** (Denominazione, Indirizzo+Maps, CAP, Città, Prov) — il vincolo "se indirizzo allora CAP/Città/Prov" resta solo se la sezione è aperta e l'indirizzo compilato
- **Referente in Compagnia**: Nome, Email, Telefono
- **Note** generali

Sezione collassata di default su nuovo rapporto; aperta automaticamente in modifica se almeno un campo opzionale è valorizzato.

## Validazione save

```text
gruppo_compagnia_id ✓
nome_rapporto.trim() ✓
ramiRows: ≥1 con gruppo_ramo_id + (all || ramo_ids.length>0)
iban valido (validateIban)
intestatario: fallback automatico = nome_rapporto se vuoto
```

Errori inline (bordo destructive + testo) sui campi obbligatori, niente solo toast.

## Comportamento IBAN

Diventa obbligatorio: rimosso il path "salva senza conto bancario". Toast warning su IBAN non valido eliminato — sostituito da errore inline sul campo.

## Fuori scope

- Nessuna modifica DB / migration: tutti i campi opzionali restano in schema, semplicemente non richiesti dalla UI.
- Maps autocomplete sulla sede resta com'è (già integrato).
- Nessun impatto su tabella elenco rapporti o lettura.

## File toccato

- `src/components/compagnie/RapportiCompagniaDialog.tsx` (UI form + logica `disabled` + `saveMutation` precondizioni)
