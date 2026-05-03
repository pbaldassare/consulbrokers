## Obiettivo
Nella scheda Cliente (e nel modal "Nuovo Cliente"), per i clienti di tipo **AZIENDA / ENTE**:

1. Quando l'utente digita una **Partita IVA** di 11 cifre, copiare automaticamente lo stesso valore nel **Codice Fiscale Azienda** (se vuoto), lasciandolo comunque modificabile.
2. Verificare/garantire che il campo **Sede** sia un autocomplete Google Maps che compila automaticamente **Indirizzo Sede, Città Sede, Provincia Sede, CAP Sede**.

## Stato attuale (verificato)
- `src/pages/ClienteDetail.tsx` (riga 110-116): esiste già la copia inversa **CF azienda (11 cifre) → P.IVA**, ma NON il contrario.
- `src/pages/ClienteDetail.tsx` (riga 1856): il campo "Sede" usa già `FieldAddress` → `AddressAutocomplete`, che riempie `indirizzo_sede`, `cap_sede`, `citta_sede`, `provincia_sede`. Quindi la parte maps è già in piedi (recentemente sistemata). Le righe successive (1857-1859) mostrano comunque i 3 campi come Input semplici per consentire correzione manuale.
- `src/components/clienti/NuovoClienteDialog.tsx`: stesso schema da allineare per coerenza.

## Modifiche

### 1. `src/pages/ClienteDetail.tsx`
Nel `FieldInput.onChange` (intorno riga 104-117), aggiungere il blocco simmetrico:

```ts
if (field === "partita_iva" && val.length === 11 && /^\d{11}$/.test(val) && !ef.codice_fiscale_azienda) {
  updateField("codice_fiscale_azienda", val);
  toast.info("Codice Fiscale Azienda copiato dalla Partita IVA");
}
```

Il campo `codice_fiscale_azienda` resta editabile, quindi l'utente può sempre modificarlo dopo la copia automatica.

### 2. `src/components/clienti/NuovoClienteDialog.tsx`
- Applicare la stessa logica di copia P.IVA → CF Azienda sull'`onChange` del campo Partita IVA (mantenendo la copia inversa già esistente).
- Verificare che il campo "Sede / Indirizzo sede" usi `AddressAutocomplete` con `onSelect` che popola CAP/Città/Provincia tramite functional update (`setFormData(prev => ({...prev, ...}))`); se è un Input semplice, sostituirlo con `AddressAutocomplete` analogamente a `SediManager.tsx`.

### 3. Sede in ClienteDetail
Nessuna modifica al campo Sede: è già `FieldAddress` con autocompilazione. Verificare in preview che, selezionando un indirizzo dal menu Google, i tre campi sotto (Città/Provincia/CAP) si popolino. Se il problema persiste lì, il fix è già stato fatto in `AddressAutocomplete.tsx` con il fallback Geocoder + parsing manuale.

## Note
- Nessuna modifica DB.
- Nessuna logica retroattiva sui clienti esistenti.
- Bump `public/version.json`.
