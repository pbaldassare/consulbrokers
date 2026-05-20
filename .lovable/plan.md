## Problema
Il codice usa `abi` / `cab`, ma in DB le colonne si chiamano `codice_abi` / `codice_cab`. Da qui l'errore "Could not find the 'abi' column of 'conti_bancari'".

## Fix (un solo file)
`src/components/compagnie/RapportiCompagniaDialog.tsx`:
- Riga 194 (select): `abi, cab` → `codice_abi, codice_cab`
- Righe 206-207 (mapping da DB): `d.abi` → `d.codice_abi`, `d.cab` → `d.codice_cab`
- Righe 234-235 (payload upsert): `abi:` → `codice_abi:`, `cab:` → `codice_cab:`

Nessuna migrazione necessaria — le colonne esistono già con i nomi corretti.