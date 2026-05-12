## Obiettivo
Risolvere due regressioni nell'import polizza AI:
1. Per i clienti **privato** non vengono mai separati Nome/Cognome dal `contraente_nome` restituito dall'AI.
2. Il match con un cliente esistente fallisce per piccole differenze (spazi, case) anche quando il CF/P.IVA è identico → la polizza viene importata "scollegata".

## Modifiche

### 1. `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx` — `lookupClienti`
- Normalizzare CF/P.IVA estratti dall'AI: `trim()`, `replace(/\s+/g,"")`, `toUpperCase()` per il CF.
- Sostituire `codice_fiscale.eq.${cf}` con `codice_fiscale.ilike.${cf}` (e idem per `partita_iva`) per assorbire eventuali differenze di case.
- Log esplicito quando arriva CF/P.IVA ma il match dà 0 risultati: `log("warn", "CF/P.IVA presente ma nessuna corrispondenza esatta — provo ricerca per nome")` così è subito chiaro nella UI.
- Se l'unico candidato esatto su CF/P.IVA viene trovato, log `success` con il label del cliente.

### 2. `src/pages/ImmissionePolizzaPage.tsx` — `handleAIImportApply`
Aggiungere split Nome/Cognome quando il tipo è `privato`:
- Tokenizza `contraente_nome` su whitespace.
- Se ≥ 2 token: primo token → `nome`, restanti → `cognome` (convenzione italiana "NOME COGNOME", coerente con il PDF AmTrust e con la maggior parte delle schede polizza).
- Se 1 solo token: lo lascia in `nome`.
- Risultato passato a `NuovoClienteDialog` come `initialData.nome` + `initialData.cognome`.

### 3. `src/components/clienti/NuovoClienteDialog.tsx` — useEffect prefill
Già splitta `ragioneSociale` quando manca `nome`. Aggiungere splitting analogo se `initialData.nome` contiene spazi e `initialData.cognome` è vuoto:
- Salvaguardia: se arriva `nome="GIUSEPPE AMUSO"` senza `cognome`, splittare `nome` su whitespace → primo token = nome, resto = cognome.
- Mantiene retro-compatibilità con altri caller che già passano nome/cognome separati.

## Out of scope
- Cambi al prompt AI / edge function `parse-polizza-completa`.
- Bonifica clienti esistenti già "scollegati" (es. correzione manuale di anagrafiche con nome+cognome duplicati).
- Logica di scelta "NOME COGNOME" vs "COGNOME NOME": adottiamo la convenzione standard "NOME COGNOME"; eventuali casi inversi li corregge l'utente in dialog.
