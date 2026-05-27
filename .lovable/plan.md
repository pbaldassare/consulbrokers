# Piano: AE + Produttore in "Assegnazioni Gestionali"

## Cosa cambia (UI)

Nella card **Assegnazioni Gestionali** (`src/pages/ClienteDetail.tsx`, ~riga 1909) la griglia passa da 3 a **5 colonne** (md:grid-cols-5, su mobile resta 1 colonna):

1. Sede (esistente)
2. Gruppo Finanziario (esistente)
3. Specialist (esistente)
4. **Account Executive** (nuovo)
5. **Produttore** (nuovo)

Entrambi i nuovi `SearchableSelect`:
- Includono opzione vuota ("— Nessuno —") per ripulire assegnazioni errate, coerente con la modifica recente fatta su Sede/Specialist/Produttore in Immissione.
- Salvataggio immediato `onValueChange` (nessun pulsante Salva separato), stessa UX dello Specialist.
- Stile compatto `h-8 text-xs`.
- In modalità `readOnly` mostrano il nome in testo.

La nota finale viene rimossa: l'assegnazione AE/Produttore avviene qui, non più solo in "Rete Commerciale".

## Cosa cambia (dati)

Nessuna modifica DB. Riuso della tabella e logica già esistenti in `CodiciCommercialiSection`:

- Tabella: `codici_commerciali_cliente`
- Ruoli: `AE` (tipo anagrafica `account_executive`) e `Produttore Sede` (tipo `corrispondente`)
- Fonte opzioni: `anagrafiche_professionali` (`attivo=true`), via gli stessi hook canonici `useAccountExecutivesLookup` e `useProduttoriLookup`.
- Upsert con `onConflict: cliente_id,ruolo`; valore vuoto → `delete` della riga (stessa mutation già usata).

Per evitare duplicazione, il blocco nuovo nella card riusa la stessa query `codici_commerciali` + la stessa `upsertMutation` di `CodiciCommercialiSection`. Estraggo quella logica in un piccolo hook locale `useCodiciCommerciali(clienteId)` (stesso file) che ritorna `{ getAnagraficaByRuolo, setAnagraficaByRuolo }`, usato sia dalla nuova UI in Assegnazioni Gestionali sia dalla sezione Rete Commerciale esistente (che resta invariata per chi la usa già).

## Sezione "Rete Commerciale"

Resta come è, mostra gli stessi due valori AE/Produttore. Modificando da una parte si aggiorna anche l'altra (cache react-query invalidata via `queryKey: ["codici_commerciali", clienteId]`).

## File toccati

- `src/pages/ClienteDetail.tsx` — estrazione hook locale, aggiunta 2 select in Assegnazioni Gestionali, griglia a 5 colonne, rimozione nota informativa.
- `public/version.json` — bump timestamp.

## Note memoria

Nessuna nuova regola persistente: la fonte canonica AE/Produttore (anagrafiche_professionali + codici_commerciali_cliente) è già documentata in `mem://insurance/produttori-lookup-source`.
