

## Causa reale del problema

L'errore che vedi non è "rinnovo già esistente" — è **"Sede dell'utente non configurata"**. La mutation di rinnovo blocca tutto se `profiles.ufficio_id` è null, e il tuo profilo admin (`admin@consul.it`) **non ha alcuna Sede assegnata**:

```
admin@consul.it → ruolo: admin → ufficio_id: NULL
```

Quindi il flusso si interrompe alla riga 154 di `RinnovoTitoloDialog.tsx` molto prima del check anti-duplicato. Per questo l'AlertDialog "Elimina e rifai (admin)" non compare mai: il codice non ci arriva.

Il titolo origine (332437574) appartiene invece a `SEDE SAN DONA' DI PIAVE`.

## Correzione

### 1. `src/components/polizze/RinnovoTitoloDialog.tsx` — fallback Sede per admin

Cambio la regola di scelta dell'`ufficio_id` da usare nel nuovo titolo e nel movimento:

```ts
const myUfficioId = (profile as any)?.ufficio_id;
let ufficioPerRinnovo = myUfficioId;

if (!ufficioPerRinnovo) {
  if (isAdmin) {
    // Admin senza Sede: eredita dalla polizza origine (comportamento naturale)
    ufficioPerRinnovo = t.ufficio_id;
    if (!ufficioPerRinnovo) {
      throw new Error("Né l'utente né il titolo origine hanno una Sede: impossibile creare il rinnovo.");
    }
  } else {
    throw new Error("Sede dell'utente non configurata: contatta l'amministratore");
  }
}
```

Poi uso `ufficioPerRinnovo` (al posto di `myUfficioId`) sia in `insertPayload.ufficio_id` sia nel nuovo `movimenti_polizza`.

Questo:
- Non cambia nulla per gli utenti normali (che hanno una Sede sul profilo).
- Per gli admin senza Sede, fa ereditare la Sede dalla **polizza origine**, che è semanticamente corretto: il rinnovo deve restare nella stessa Sede del titolo che sostituisce.
- Sblocca il percorso "Elimina e rifai (admin)" che già esiste, perché ora la mutation arriva al check duplicati.

### 2. Memory

Aggiungo memory `mem://insurance/admin-renewal-office-fallback` con la regola: "Quando un admin esegue un Rinnovo senza avere `ufficio_id` sul profilo, la nuova polizza eredita l'`ufficio_id` dal titolo origine."

## Cosa NON tocco

- Nessuna modifica DB.
- Nessuna modifica all'AlertDialog "Elimina e rifai" (è già corretto, è solo irraggiungibile oggi).
- Nessuna modifica al profilo admin (non assegno arbitrariamente una Sede al tuo utente — se vuoi sceglierne una in modo permanente, lo facciamo da `Gestione Utenti`).

## Verifica

1. Da admin (senza Sede sul profilo), apro la polizza `332437574 / riga 0`, premo Rinnovo, **Conferma Rinnovo**.
2. Se non esiste già un rinnovo: viene creato nella Sede `SAN DONA' DI PIAVE` (ereditata dal titolo).
3. Se esiste già: compare l'AlertDialog "Esiste già un rinnovo" con i bottoni Annulla / Vai al titolo esistente / **Elimina e rifai (admin)**.
4. Cliccando "Elimina e rifai (admin)": vecchio rinnovo cancellato + nuovo creato + redirect al nuovo titolo.
5. Per un utente non admin senza Sede: il messaggio "Sede dell'utente non configurata" resta (corretto).

