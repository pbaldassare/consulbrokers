## Modifiche a Rapporti Compagnia

### 1. Bottone "Tutti i Rami" nel form rapporto
Nella sezione "Rami e Sottoramo abilitati" del `RapportiCompagniaDialog`, aggiungere accanto a "+ Aggiungi Ramo" un nuovo bottone **"+ Tutti i Rami"** che:
- popola `ramiRows` con una riga per **ogni** `gruppi_ramo` attivo, con `all=true` e `ramo_ids=[]` (equivalente a "Tutti i sottorami" per ciascun gruppo)
- sostituisce le righe esistenti (con conferma se ce ne sono già)

Risultato: un click abilita tutti i rami/sottorami senza doverli aggiungere uno per uno.

### 2. Duplicazione rapida del rapporto
Nella tabella rapporti, aggiungere accanto alle azioni 📁 / ✏️ / 🗑️ una nuova icona **📋 Duplica** che apre il form `Nuovo Rapporto` pre-compilato con tutti i campi del rapporto sorgente:
- `nome_rapporto` → `"<originale> (copia)"`
- `id` non valorizzato (verrà creato nuovo record)
- `conto_bancario_id` → `null` con IBAN/banca/intestatario/BIC/ABI/CAB **copiati nei campi conto** così l'utente li vede e può modificarli (al salvataggio si creerà un **nuovo** record `conti_bancari`, ora possibile grazie al punto 3)
- rami abilitati copiati (stessa logica di `openEdit`)
- sede, referente, note copiati

L'utente può poi modificare ciò che vuole prima di salvare.

### 3. Rimozione blocco IBAN duplicato
Attualmente esiste un unique index `conti_bancari_iban_unique` su `conti_bancari.iban` che impedisce di salvare due conti con lo stesso IBAN. Va **eliminato** via migration:

```sql
DROP INDEX IF EXISTS public.conti_bancari_iban_unique;
```

Lato UI nessuna validazione bloccante sull'unicità IBAN (la validazione formale mod-97 resta).

### File coinvolti
- `src/components/compagnie/RapportiCompagniaDialog.tsx` — bottone "Tutti i Rami", azione "Duplica", handler `openDuplicate`
- Migration DB — drop unique index su `conti_bancari.iban`

### Fuori scope
- Cambi sul resto del form (resta tutto invariato)
- Cambi su altre pagine che leggono `conti_bancari`
