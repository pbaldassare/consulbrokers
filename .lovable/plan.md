## Obiettivo

Aggiungere su ogni entità "soggetto" (utenti, sedi, agenzie, anagrafiche professionali in tutte le loro tipologie) un bottone **Elimina** accanto ad Attiva/Disattiva. Il click apre un **AlertDialog di conferma** che mostra in modo trasparente:

- quante entità collegate verranno **bloccate** (impedendo l'eliminazione),
- cosa **non viene toccato** (storico, log, audit),
- la **raccomandazione di disattivare** invece di eliminare quando ci sono collegamenti.

Se nessun collegamento esiste → eliminazione hard. Altrimenti → bottone Elimina disabilitato + CTA "Disattiva invece".

## Elenco soggetti che ricevono il bottone Elimina

Mappato dai FK in DB e dalle pagine UI esistenti.

| # | Soggetto | Pagina/Componente | Tabella | Stato attuale | Da fare |
|---|---|---|---|---|---|
| 1 | **Utenti gestionali** (admin, AE, backoffice, executive, ufficio, cfo) | `GestioneUtentiPrivilegi.tsx` | `profiles` | solo toggle attivo | + Elimina |
| 2 | **Sedi** (uffici) | `SediManager.tsx` (in `GestioneUfficiPage`) | `uffici` | toggle | + Elimina |
| 3 | **Specialist** (backoffice contabili) | `SpecialistList.tsx` | `profiles` | toggle | + Elimina |
| 4 | **Anagrafiche Agenzie** (compagnie + gruppi compagnia) | `AnagraficheCompagniePage.tsx` / `CompagnieList.tsx` | `compagnie`, `gruppi_compagnia` | toggle | + Elimina |
| 5 | **Anagrafiche Amministrative** — tutte le 8 tipologie nello stesso elenco: liquidatore, perito, legale, account_executive, **corrispondente** (Produttore/Consul), **executive**, **responsabile_sede**, **produttore_sede** | `AnagraficheInternePage.tsx` | `anagrafiche_professionali` | Elimina già presente ma controlla solo `titoli.produttore_id` | Estendere impact-check (vedi sotto) |
| 6 | **Conti bancari** | `ContiBancariPage.tsx` | `conti_bancari` | da verificare in implementazione | + Elimina con check su titoli/pagamenti |

> Note: prospect/clienti hanno già il loro flusso "merge/disattivazione" separato (vedi `merge_cliente_atomico`) e non rientrano in questo task. Compagnie/gruppi sono richiamati dal singolo termine "anagrafiche agenzie".

## Impact-check per soggetto (cosa contare prima di eliminare)

Tutti i conteggi sono `select count exact head:true`, fatti in parallelo dalla mutation. Se anche **uno solo** è > 0 → eliminazione bloccata.

### Utenti / Specialist (`profiles`)
Conta su:
- `titoli.commerciale_id`, `titoli.produttore_id`, `titoli.backoffice_id`
- `clienti.commerciale_id`, `clienti.backoffice_id`, `clienti.user_id`
- `sinistri.assegnato_a`, `sinistri.created_by`
- `trattative.assegnato_a`
- `chat_canali_membri.user_id` (questo non blocca, solo informativo)

### Sedi (`uffici`)
Conta su: `clienti.ufficio_id`, `titoli.ufficio_id`, `sinistri.ufficio_id`, `profiles.ufficio_id`, `anagrafiche_professionali.ufficio_id`, `conti_bancari.ufficio_id`, `movimenti_contabili.ufficio_id`, `distinte_giornaliere.ufficio_id`.

### Compagnie / Gruppi compagnia
Conta su: `titoli.compagnia_id`, `prodotti.compagnia_id`, `sinistri.compagnia_id`, `compagnia_rapporti.compagnia_id` (per i gruppi: `compagnia_rapporti.gruppo_compagnia_id`, `compagnie.gruppo_compagnia_id`).

### Anagrafiche professionali (tutte le tipologie)
Estendere il check attuale (solo `produttore_id`) con:
- `titoli.anagrafica_commerciale_id` ← oggi mancante, oggi è la FK "vera"
- `clienti.anagrafica_commerciale_id`
- `sinistri.liquidatore_id`, `sinistri.perito_id`, `sinistri.legale_id`
- `produttori_provvigioni_ramo.anagrafica_id` (cascade già configurato? verificare; in caso bloccare comunque)

## UI del dialog di conferma

Componente nuovo: `src/components/common/DeleteWithImpactDialog.tsx`, usato da tutte le pagine.

Props: `entityName`, `entityType`, `impactCounts` (array di `{label, count, blocking}`), `onConfirm`, `onDeactivateInstead`.

Layout dialog:

```text
┌─ Elimina {entityType}? ─────────────────────────┐
│                                                 │
│ Stai per eliminare definitivamente:             │
│   {entityName}                                  │
│                                                 │
│ Verifica collegamenti                           │
│   • 12 polizze         BLOCCANTE                │
│   • 3 clienti          BLOCCANTE                │
│   • 0 sinistri          ok                      │
│                                                 │
│ Cosa succede:                                   │
│   - I dati anagrafici verranno cancellati       │
│   - Storico chat, log attività e audit          │
│     restano (riferimenti sostituiti con id)     │
│                                                 │
│ Cosa NON succede:                               │
│   - Polizze, clienti e sinistri NON vengono     │
│     toccati (sarebbe distruttivo).              │
│                                                 │
│ ⚠ Eliminazione bloccata: 15 collegamenti.       │
│   Usa "Disattiva" per renderlo non selezionabile│
│   senza rompere lo storico.                     │
│                                                 │
│   [Annulla]    [Disattiva invece]    [Elimina]  │
│                                       (disabled)│
└─────────────────────────────────────────────────┘
```

Quando 0 collegamenti: messaggio "Nessun collegamento trovato — eliminazione sicura" e bottone Elimina abilitato (variant `destructive`, doppio click di sicurezza non necessario, basta il dialog).

## Modifiche file

1. **Nuovo componente** `src/components/common/DeleteWithImpactDialog.tsx` — wrap su `AlertDialog` shadcn, mostra lista impact, due CTA ("Disattiva invece" se `onDeactivateInstead` passato, "Elimina" disabilitato se blocking>0).
2. **Nuovo hook** `src/hooks/useEntityImpact.ts` — riceve `{table, fkChecks: [{table, column}]}`, esegue i count in parallelo, ritorna `{counts, totalBlocking, isLoading}`.
3. **`src/pages/GestioneUtentiPrivilegi.tsx`** — bottone Elimina su ogni riga, dialog con check FK profiles.
4. **`src/components/anagrafiche/SediManager.tsx`** — bottone Elimina, dialog con check FK uffici.
5. **`src/components/anagrafiche/SpecialistList.tsx`** — bottone Elimina, dialog con check FK profiles ridotti (solo backoffice).
6. **`src/pages/AnagraficheCompagniePage.tsx`** + **`src/pages/CompagnieList.tsx`** — bottone Elimina su compagnie e gruppi, dialog con check FK rispettivi.
7. **`src/pages/AnagraficheInternePage.tsx`** — sostituire l'attuale `confirmDeleteOpen` minimale col nuovo dialog ed estendere il pre-check con `anagrafica_commerciale_id`, sinistri (liquidatore/perito/legale), clienti.
8. **`src/pages/anagrafiche/ContiBancariPage.tsx`** — bottone Elimina con check su titoli/pagamenti se collegano l'IBAN.

Nessuna modifica DB. Nessuna nuova migration. L'eliminazione resta una `DELETE` standard con RLS esistenti; il blocco è applicativo (UX) + protezione FK lato DB (l'errore PG è comunque catchato e mostrato).

## Out of scope

- Soft-delete come pattern globale (non richiesto, useremmo `attivo=false` come oggi).
- Cascade delete su entità collegate (esplicitamente vietato — il dialog lo dice).
- Pagine `clienti` e `prospect` (hanno già flusso merge/disattivazione dedicato).
