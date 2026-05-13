## Bug
Riga 441 di `src/pages/ClienteDetail.tsx`:
```ts
hidePercentualeBrand={r.value === "Account Executive" || r.value === "Produttore Sede"}
```
`r.value` contiene gli enum `"account_executive"` / `"produttore_sede"` (definiti righe 378/381), non le label leggibili. Quindi la condizione è sempre `false` → in **Cliente Detail** i campi `% Provvigione` e `Società/Brand` continuano a vedersi sotto "Agente" e "Produttore Sede" (vedi screenshot).

## Fix
Una sola riga, in `src/pages/ClienteDetail.tsx` (riga 441):
```ts
hidePercentualeBrand={r.value === "account_executive" || r.value === "produttore_sede"}
```

Nessuna altra modifica. La logica condizionale dentro `CodiceCommercialeRow` (riga 513, `{!hidePercentualeBrand && (...)}`) è già corretta.

## Verifica
Aprire un cliente esistente → tab Dati Gestionali → sezioni "Agente" e "Produttore Sede" non devono più mostrare i campi `% Provvigione` e `Società/Brand`. La sezione "Specialist" resta invariata con tutti i campi.
