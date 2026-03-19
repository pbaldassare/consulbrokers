

## Piano: Seed dati esempio Cliente ↔ Polizze ↔ Aziende

### Situazione
- Ci sono clienti privati e aziende nel DB, ma **zero titoli (polizze)** e **zero relazioni** nella tabella `clienti_relazioni`
- Per mostrare un esempio funzionante serve inserire dati demo

### Cosa faremo

**Migration che inserisce:**

1. **5 polizze** collegate a **Paola Colombo** (cliente privato `3fa445e7-...`) tramite `cliente_anagrafica_id`
   - Polizze con numeri realistici, stati diversi (vigente, scaduta, sospesa), premi variati

2. **2 relazioni** tra Paola Colombo e aziende esistenti:
   - Paola Colombo → **IT Solutions Sorrentino S.a.s.** (tipo: `dipendente`)
   - Paola Colombo → **Immobiliare Moderna Martini S.r.l.** (tipo: `legale_rappresentante`)

3. **2 polizze** collegate a una delle aziende (IT Solutions Sorrentino) per mostrare anche polizze aziendali

Dopo il seed, navigando su `/archivi/clienti/{id-paola-colombo}` si vedranno:
- Tab **Polizze**: 5 polizze elencate con link al dettaglio
- Tab **Relazioni**: 2 aziende collegate con badge tipo relazione
- Cliccando sull'azienda → si vedranno le sue polizze e il link di ritorno a Paola

### File coinvolti

| Azione | File |
|--------|------|
| Migration | Inserimento polizze demo + relazioni demo |

