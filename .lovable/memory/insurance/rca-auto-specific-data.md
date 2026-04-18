---
name: RCA Auto Specific Data
description: Validazioni e automazioni per polizze RCA Auto - catalogo veicoli locale con inserimento manuale
type: feature
---

La gestione delle polizze RCA Auto integra:

- **Catalogo veicoli locale**: tabelle `veicoli_marche` e `veicoli_modelli` (DB) precaricate con ~33 marche e ~350 modelli più diffusi in Italia. Flag `popolare` per ordinamento intelligente (popolari in cima).
- **Inserimento manuale**: il componente `MarcaModelloCombobox` consente di aggiungere on-the-fly nuove marche/modelli direttamente dal form RCA con la voce "+ Aggiungi: «...»" in fondo alla lista. Auto-uppercase via trigger DB.
- **Permessi**: lettura per tutti gli authenticated; INSERT/UPDATE riservato a staff (esclusi cliente/prospect).
- **Hook**: `useVehicleMakes()`, `useVehicleModels(marca)`, `useAddMarca()`, `useAddModello()` in `src/hooks/useVehicleLookup.ts`.
- **Form RCA**: `ImmissionePolizzaPage.tsx` usa `MarcaCombobox` e `ModelloCombobox` (non più NHTSA API).
- **Classi BM**: 18 classi di merito (1A-18) per RCA Auto.
- **Settori/Usi**: gerarchia di lookup tramite `useRcaSettori()` e `useRcaUsi(settoreId)`.
