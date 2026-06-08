# Pagina "Carico" (ex "Carico del Mese")

## 1. Rinomina label

Sostituire ovunque "Carico del Mese" → "Carico" (route invariata `/portafoglio/carico`):

- `src/components/AppSidebar.tsx` (voce menu Portafoglio)
- `src/components/CommandPalette.tsx` (entry `go-carico`)
- `src/hooks/useNavigationHistory.ts` (mappa breadcrumb — già "Carico" nello screenshot, verificare)
- `src/pages/PortafoglioCaricoPage.tsx`: titolo H1 e sottotitolo
- Riferimenti testuali dentro `SospensionePolizzaDialog.tsx` e `TitoloDetail.tsx` aggiornati al nuovo nome ("Carico").

Nessuna modifica al path della route né al nome del file pagina.

## 2. Nuovo modello filtro periodo

Stato locale aggiunto: `filtroPeriodo: "arretrati" | "mese_corrente" | "messe_cassa" | "tutte"`.

Default all'apertura: `"arretrati"` = mese corrente + tutti i mesi precedenti **non ancora messe a cassa**.

I 3 pulsanti toggle (group `ToggleGroup` o `Button` con stato `default`/`outline`) mostrati in alto, sopra le card contatore:

```text
[ Mese Corrente ]  [ Messe a Cassa ]  [ Tutte ]
```

Mapping pulsante → comportamento dati:

- **Mese Corrente** (`mese_corrente`): `data_scadenza` nel mese corrente AND `stato = 'attivo'` (non a cassa).
- **Messe a Cassa** (`messe_cassa`): `data_messa_cassa` non null nel mese corrente (mantiene la finestra mese corrente, come oggi quando `filtroStato=incassato`).
- **Tutte** (`tutte`): unione di → polizze `stato='attivo'` con `data_scadenza <= fine mese corrente` (include arretrati) + polizze `stato='incassato'` con `data_messa_cassa` nel mese corrente.

Il **default `arretrati`** è il caso speciale equivalente a "Tutte" ma **senza le polizze già a cassa**: `stato='attivo'` con `data_scadenza <= fine mese corrente`. Lo rendiamo lo stato iniziale, ma non gli serve un quarto pulsante: appena l'utente clicca uno dei tre toggle, si passa a quella vista. Il pulsante visivamente "attivo" al primo render è **Mese Corrente** (perché di fatto il default è la versione estesa del mese corrente: stessi titoli del mese + arretrati non a cassa). 

→ Decisione: il **toggle "Mese Corrente" risulta attivo** all'apertura, ma il comportamento dati è "arretrati + mese corrente non a cassa". Quando l'utente clicca di nuovo "Mese Corrente" il filtro si stringe al solo mese corrente. Per renderlo chiaro, sotto i pulsanti compare una piccola label: "Inclusi arretrati non a cassa" quando il filtro è in modalità default; sparisce dopo qualsiasi click utente.

## 3. Query unificata

Riscrittura della `useQuery(["portafoglio-carico", …])` per supportare i 4 casi:

```ts
const meseStart = startOfMonth(caricoDate);
const meseEnd   = endOfMonth(caricoDate);

switch (filtroPeriodo) {
  case "arretrati":      // default
    q = base.eq("stato","attivo").lte("data_scadenza", meseEnd);
    break;
  case "mese_corrente":
    q = base.eq("stato","attivo")
            .gte("data_scadenza", meseStart).lte("data_scadenza", meseEnd);
    break;
  case "messe_cassa":
    q = base.eq("stato","incassato")
            .gte("data_messa_cassa", meseStart).lte("data_messa_cassa", meseEnd);
    break;
  case "tutte":
    // due query in parallelo + merge lato client, oppure RPC dedicata
    break;
}
```

Per il caso `tutte`, dato che combinare due range diversi su due colonne diverse in una sola query Supabase è scomodo, eseguire **due query in parallelo** (attive ≤ meseEnd; incassate nel mese) e fare merge client-side, ordinando per `data_scadenza` desc. La paginazione passa a client-side **solo per "tutte"** (volume contenuto: max poche centinaia di righe nel mese). Per gli altri tre filtri resta server-side come oggi.

## 4. Contatori dinamici

Le 4 card (Totale titoli / Polizze / Quietanze / In attesa rinnovo) vanno ricalcolate sui medesimi filtri della tabella:

- Riscrivere `useQuery(["portafoglio-carico-totale", …])` aggiungendo `filtroPeriodo` alla key e applicando lo stesso `switch` per la finestra temporale e lo stato.
- "In attesa rinnovo" (pendingRinnovi) resta legato al **mese corrente** sempre (è una metrica indipendente sui titoli `in_attesa_rinnovo` del mese), e non viene toccata dal toggle.

## 5. Persistenza URL

Rimuovere il vecchio param `?stato=`; introdurre `?periodo=arretrati|mese_corrente|messe_cassa|tutte`. Sincronizzazione bidirezionale (lettura iniziale + push su cambio toggle) per consentire deep-link.

## 6. Out of scope

- Nessuna modifica a `MessaCassaDialog`, navigazione mensile (chevron) e selezione multipla: continuano a operare sull'attuale `caricoDate`.
- Nessuna modifica a `v_portafoglio_titoli` o trigger DB.
- Storico Polizze e Polizze Attive invariati.

## Note tecniche

- Aggiungere `ToggleGroup` (`@/components/ui/toggle-group` già presente in shadcn) con i 3 valori.
- Eliminare il vecchio stato `filtroStato` e il selettore "Entrambe le opzioni" nello screenshot? **No**, restano i filtri `filtroTipo` (Polizze + Quietanze) e search invariati: convivono con il nuovo toggle.
- Sottotitolo pagina diventa: "Mese di {Giugno 2026}" + chip "include arretrati non a cassa" nel caso default.
