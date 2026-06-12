## Obiettivo
Nel portale cliente del Comune di Varese (`/cliente/polizze`) devono sparire le **11 polizze demo** `DEMO-VA-*` e devono apparire le **6 polizze reali** caricate ieri tramite il parser CGA (tabella `polizza_cga`):

| N° Polizza | Prodotto | Compagnia | Scadenza |
|---|---|---|---|
| G00304257 | Incendio/Furto/Kasko veicoli (Lotto IV) | Global Assistance | 30/11/2027 |
| 50800691 | Infortuni Cumulativa Amm./Dip. | Helvetia | 30/11/2027 |
| OX00085594 | REVO SpecialtyX Cyber Risk | REVO | 30/04/2028 |
| (senza n°) | REVO SpecialtyX Cyber Risk | REVO | — |
| (senza n°) | All Risks | ITAS Mutua | — |
| (senza n°) | All Risks | ITAS Mutua | — |

## Cosa farò

### 1. Pulizia dati demo (DB)
Cancello dal cliente `Comune di Varese` (id `94dc5a3c-...`):
- gli 11 record in `titoli` con `numero_titolo LIKE 'DEMO-VA-%'`
- a cascata: provvigioni, movimenti, quietanze, rimesse collegate (riuso la stessa logica della cancellazione polizza).

I 4 sinistri demo `SIN-VA-*` li lascio: l'utente non ha chiesto di toccarli. Posso eliminarli in un secondo step se vuoi.

### 2. Frontend `/cliente/polizze` mostra anche le polizze_cga
Modifico `src/pages/cliente/ClientePolizze.tsx` per fare **due query in parallelo** e fondere i risultati in una sola tabella:
- `titoli` (come oggi) → polizze "amministrative"
- `polizza_cga` JOIN `prodotti_cga` filtrate per `cliente_id IN get_my_cliente_ids()` e `stato='approvato'` → polizze "da CGA"

Normalizzo entrambi gli oggetti in una shape comune:
```
{ id, source: 'titoli'|'cga', stato, compagnia, prodotto, numero, data_scadenza, premio_lordo, premio_netto, frazionamento, ... }
```
Le righe da `polizza_cga` mostrano:
- Stato: badge "Approvata" (verde) se `stato='approvato'`
- Compagnia: `prodotti_cga.compagnia`
- Prodotto: `prodotti_cga.nome_prodotto` (fallback `ramo`)
- N° Polizza: `numero_polizza` (o "—" se mancante)
- Scadenza/Premi: dai campi di `polizza_cga`
- Click → naviga a `/cliente/assistente?polizza=<id>` (la detail per CGA non esiste ancora nel portale; l'assistente AI ha già il contesto della singola polizza).

Filtri e totali continuano a funzionare su entrambe le sorgenti.

### 3. Nessun cambio a backend/edge function
`chiedi-mie-polizze` legge già entrambe le sorgenti, quindi resta com'è.

## File toccati
- migrazione/insert: DELETE su `titoli` (e tabelle correlate) per i DEMO-VA-* del Comune di Varese
- `src/pages/cliente/ClientePolizze.tsx`: doppia fetch + merge

## Cosa NON farò (per non sforare)
- Non tocco i sinistri demo `SIN-VA-*` (chiedi e li elimino).
- Non costruisco una pagina di dettaglio CGA dedicata: per ora il click sulla riga CGA porta all'Assistente.
- Non rimuovo seed function / memoria demo (resta per altri ambienti); cancellazione solo dati del Comune di Varese.

Confermi e passo in build?