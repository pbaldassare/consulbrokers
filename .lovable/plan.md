## Obiettivo

Far sì che **tutte le anagrafiche cliente esistenti** in `ClienteDetail.tsx` si comportino esattamente come il modal "Nuovo Cliente": i campi anagrafici mostrati (Privato / Azienda / Ente) sono governati **dal `tipo_soggetto` del Gruppo Finanziario** assegnato, non dal `tipo_cliente` storico salvato a DB.

## Caso visibile (screenshot)

Cliente "A.C.E.N." → Gruppo Finanziario `AZ_PRIV` (tipo_soggetto = `azienda`), ma:
- Badge sotto il titolo: "Cliente Privato"
- Campi mostrati: Codice Fiscale 16, Data Nascita, Luogo Nascita, Indirizzo Residenza (layout PRIVATO)
- Mancano P.IVA, Forma Giuridica, CF Azienda, SDI, Sede

Stesso problema su tutti i clienti vecchi con `tipo_cliente` disallineato dal gruppo.

## Causa nel codice (`src/pages/ClienteDetail.tsx`)

- Riga 1331: `const isPrivato = cliente.tipo_cliente === "privato"` (legge il valore originale del DB).
- Riga 1403: `const isEnte = cliente.tipo_cliente === "ente"` (idem).
- Riga 1194-1200: la derivazione da `gruppo_finanziario.tipo_soggetto` esiste **solo dentro `updateField`**, quindi scatta solo se l'utente cambia attivamente il gruppo. Per i record già esistenti, all'apertura, niente.
- Badge titolo e validazione `missingFields` usano la stessa variabile statica.

Risultato: i clienti vecchi vedono il layout sbagliato finché qualcuno non riapre/cambia il gruppo.

## Modifica (un solo file)

**`src/pages/ClienteDetail.tsx`** — calcolo unico, derivato live, applicato a tutto:

1) Sostituire `isPrivato` / `isAzienda` / `isEnte` con un valore derivato dal gruppo selezionato in `ef`:

```ts
const gfSelected = (gruppiFinanziari as any[])
  .find(g => g.id === ef.gruppo_finanziario_id);
const effectiveTipoCliente: "privato" | "azienda" | "ente" =
  (gfSelected?.tipo_soggetto as any)
  || ef.tipo_cliente
  || cliente.tipo_cliente
  || "privato";

const isPrivato = effectiveTipoCliente === "privato";
const isAzienda = effectiveTipoCliente === "azienda";
const isEnte    = effectiveTipoCliente === "ente";
```

Il render condizionale del form (rige 1764-1818), la validazione campi obbligatori (rige 1407-1432) e la logica P.IVA / CUP usano già queste variabili: si allineano automaticamente a tutto il database, anche per i record storici.

2) **Auto-allineamento all'apertura** in `useEffect` (riga 1185-1189): quando arrivano cliente + gruppi, se `tipo_cliente` salvato è diverso dal `tipo_soggetto` del gruppo, riallinearlo nello state `editFields` (solo locale; verrà persistito al primo Salva, nessuna scrittura silenziosa a DB).

3) **Badge sotto il titolo**: sostituire `cliente.tipo_cliente` con `effectiveTipoCliente`. Se deriva dal gruppo, mostrare suffisso `(auto)` come nel NuovoClienteDialog.

4) **Selettore Tipo Cliente editabile** (se presente): renderlo read-only con badge "(auto)" — coerente con la regola `gruppi-finanziari-tipo-soggetto`.

5) **Nessuna cancellazione di dati legacy**: i campi non più visibili (es. `nome`/`cognome`/`indirizzo_residenza` su un cliente che ora è azienda) restano in DB intatti — vengono solo nascosti nella UI. Niente perdita di dati storici.

6) Bump `public/version.json`.

## Cosa NON faccio

- Nessuna migrazione DB.
- Nessun update massivo dei `tipo_cliente` esistenti: il riallineamento avviene record-per-record solo quando il singolo cliente viene aperto e poi salvato dall'utente.
- Nessun cambio al modal Nuovo Cliente (già corretto, è il riferimento).

## File toccati

- `src/pages/ClienteDetail.tsx`
- `public/version.json`

Confermi?