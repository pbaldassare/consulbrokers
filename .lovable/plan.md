
## Diagnosi

La polizza `204366651` è nel **Carico del Mese** (attiva, scaduta il 09/04/2026, non ancora messa a cassa). 

La condizione attuale in `TitoloDetail.tsx` riga 427 nasconde la sezione "Operazioni" quando:
```ts
stato === "attivo" && garanzia_a < oggi && !data_messa_cassa
```

Questa logica è **sbagliata**: nasconde proprio le polizze fuori copertura/in carico, che sono quelle su cui l'utente deve poter agire (sospendere, stornare, rinnovare, fare appendici).

## Piano

### File toccato
- `src/pages/TitoloDetail.tsx` (riga 426-427)

### Modifica
Rimuovere il branch problematico. Le operazioni vanno nascoste **solo** per polizze in stato terminale `scaduto` o `sospeso` (che sono già state lavorate e archiviate). Per le polizze `attivo`, anche se `garanzia_a` è nel passato, le operazioni devono essere disponibili.

**Nuova condizione:**
```tsx
{!(t.stato === "scaduto" || t.stato === "sospeso") && (
  <Card>...Operazioni...</Card>
)}
```

### Risultato atteso sulla polizza `204366651`
La card "Operazioni" tornerà visibile con tutti i pulsanti: Sospensione, Riattivazione, Duplicazione, **Appendici**, Storno, Regolazione, Annullamento.

### Cosa NON cambia
- La logica della card "Messa a Cassa" (gating poliennale) resta identica.
- Per polizze `scaduto`/`sospeso` la sezione resta correttamente nascosta.
