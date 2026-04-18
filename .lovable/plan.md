
## Diagnosi

L'utente è sulla scheda cliente (GASTALDELLO SAMANTHA, `/archivi/clienti/:id`) nel tab **Polizze (0)** che mostra "Nessuna polizza collegata a questo cliente". Vuole poter:
1. **Creare/inserire una polizza direttamente dalla scheda cliente** (senza passare da `/portafoglio/immissione` e ri-selezionare il cliente)
2. **Visualizzare** le polizze collegate nel tab

## Esplorazione necessaria

Verifico in `ClienteDetail.tsx`:
- Come è strutturato il tab "Polizze" attuale
- Se esiste già una query per recuperare i titoli del cliente (probabilmente solo placeholder visto "Polizze (0)" e il messaggio)
- Se c'è un contatore reale o sempre 0

## Soluzione

### 1. Tab Polizze — visualizzazione
- Query a `v_portafoglio_titoli` (vista già esistente per portafoglio, vedi memoria `portfolio-management-views`) filtrata per `cliente_id = cliente.id`
- Tabella compatta: Numero polizza, Compagnia, Ramo, Decorrenza, Scadenza, Premio, Stato (badge)
- Riga cliccabile → naviga a `/portafoglio/titoli/:id` (dettaglio titolo)
- Aggiornare contatore `Polizze (N)` con il count reale

### 2. Pulsante "+ Nuova Polizza" nel tab
- In alto a destra del tab Polizze: `<Button>+ Nuova Polizza</Button>`
- Click → `navigate("/portafoglio/immissione?clienteId=" + cliente.id)`
- In `ImmissionePolizzaPage.tsx`: leggere il query param `clienteId`, se presente pre-selezionare il cliente all'avvio (riusando la logica già esistente di selezione cliente, che eredita Sede/AE/Specialist)

### 3. Stato vuoto migliorato
- Se 0 polizze: messaggio + CTA centrale "Crea la prima polizza per questo cliente"

## File toccati

- `src/pages/ClienteDetail.tsx` — query polizze del cliente, tabella, contatore reale, pulsante "+ Nuova Polizza"
- `src/pages/ImmissionePolizzaPage.tsx` — lettura `?clienteId=` da URL e pre-selezione cliente

## Cosa NON cambia

- Schema DB, vista `v_portafoglio_titoli`
- Pagina `/portafoglio/immissione` (logica form, ereditarietà dati)
- Route esistenti

## Note implementazione

In fase di sviluppo verifico:
- Nome esatto della rotta dettaglio titolo (`/portafoglio/titoli/:id` o `/titoli/:id`)
- Colonne disponibili in `v_portafoglio_titoli` (già documentate in memoria `portfolio-view-calculated-fields`: `cliente_nome_display`, ecc.)
- Pattern di routing già usato altrove per "torna al cliente" dopo creazione polizza (eventuale redirect post-save)
