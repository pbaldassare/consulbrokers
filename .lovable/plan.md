## Obiettivo

Aggiungere accanto allo Switch Attiva/Disattiva nella riga di **`/compagnie` → tab Agenzie** un pulsante **"Provvigioni"** (icona %) che apre un popup con le provvigioni dell'agenzia. Se l'agenzia ha più rapporti attivi (`compagnia_rapporti`), il popup li mostra tutti con un selettore. Nessuna riscrittura di logica: si riusa il componente esistente.

## Cosa ho capito (vincoli del progetto)

1. La form "Modifica Agenzia" è volutamente pulita (memoria `compagnie-form-pulita`): non rimetto provvigioni lì dentro.
2. Le provvigioni sono salvate in `provvigioni_compagnia_ramo` con FK `compagnia_rapporto_id` → quindi sono legate a record di `compagnia_rapporti`. (memoria `compagnia-rapporti-multipli`)
3. Per memoria `rapporto-principale-implicito`, l'agenzia stessa è il proprio rapporto principale ma **non** ha riga in `compagnia_rapporti` (questo è il "+1" mostrato nel badge Network). Quindi le provvigioni mostrabili sono solo quelle dei rapporti registrati in `compagnia_rapporti`. Se non ce ne sono, mostro empty-state con CTA che apre il dialog Rapporti già esistente (`RapportiCompagniaDialog`).
4. La matrice provvigioni esistente è `src/components/compagnie/ProvvigioniRapportiTab.tsx` e accetta già `fixedRapportoId` (modalità bloccata su un singolo rapporto). Riuso esattamente quella — niente UI nuova per la matrice, le regole sono già lì (rami abilitati da `compagnia_rapporto_rami`, default, AI import, paste/copia, ecc.).

## Modifiche

### 1. Nuovo componente `src/components/compagnie/ProvvigioniCompagniaDialog.tsx`

Props: `open`, `onOpenChange`, `compagniaId`, `compagniaNome`.

Comportamento:
- Carica `compagnia_rapporti` per `compagnia_id` (attivi = true) con `id, nome_rapporto, tipo_rapporto, gruppo_compagnia_id, gruppi_compagnia(descrizione)`.
- Stato `selectedRapportoId` (default = primo rapporto, persistito su `useState`, non serve localStorage).
- Header del Dialog: titolo "Provvigioni — {compagniaNome}" + conteggio "{n} rapporto/i".
- Se `rapporti.length === 0`: empty-state con `Network` icon, testo "Nessun rapporto configurato per questa agenzia. Le provvigioni si gestiscono per rapporto" + bottone secondario "Apri Rapporti" (callback `onOpenRapporti`) che chiude questo dialog e apre `RapportiCompagniaDialog` con la stessa agenzia.
- Se `rapporti.length === 1`: mostra il nome del rapporto in un piccolo header e renderizza `<ProvvigioniRapportiTab fixedRapportoId={rapporti[0].id} />`.
- Se `rapporti.length > 1`: selettore in alto (Tabs orizzontali se ≤ 4 rapporti, altrimenti `SearchableSelect`) con label `"{nome_rapporto} · {gruppi_compagnia.descrizione}"`; sotto `<ProvvigioniRapportiTab fixedRapportoId={selectedRapportoId} key={selectedRapportoId} />` (la key forza il remount per evitare stati residui tra rapporti).
- Dialog dimensione `max-w-7xl max-h-[90vh] overflow-hidden`, contenuto interno con scroll.

### 2. `src/pages/CompagnieList.tsx`

- Nuovo stato locale: `const [provvigioniTarget, setProvvigioniTarget] = useState<{ id: string; nome: string } | null>(null);`
- Nella cella dello Switch (riga ~1697), aggiungo un nuovo bottone icona `Percent` **prima** dello Switch:
  ```tsx
  <Button variant="ghost" size="icon" className="h-8 w-8" title="Provvigioni" onClick={() => setProvvigioniTarget({ id: c.id, nome: c.nome })}>
    <Percent className="w-4 h-4" />
  </Button>
  ```
  (avvolto in `flex items-center gap-1` con lo Switch).
- Import: `Percent` da `lucide-react` (già usato altrove nel file, da verificare).
- In fondo al componente, accanto a `<RapportiCompagniaDialog ... />`, monto `<ProvvigioniCompagniaDialog open={!!provvigioniTarget} onOpenChange={(v) => !v && setProvvigioniTarget(null)} compagniaId={provvigioniTarget?.id || null} compagniaNome={provvigioniTarget?.nome || ""} onOpenRapporti={() => { const t = provvigioniTarget; setProvvigioniTarget(null); if (t) setRapportiTarget(t); }} />`.

## Cosa NON cambio

- Niente modifiche allo schema DB, RLS, edge functions.
- Niente modifiche a `ProvvigioniRapportiTab` (riusato così com'è in modalità `fixedRapportoId`).
- Niente modifiche alla form "Modifica Agenzia" (resta a 3 tab puliti per memoria `compagnie-form-pulita`).
- Niente modifiche al badge "Network" esistente (conteggio rapporti aggiuntivi) — resta com'è.
- Nessuna modifica alla pagina `/provvigioni-compagnie-ramo` (resta la vista globale).

## Verifica

1. `/compagnie` tab Agenzie: in ogni riga, accanto allo Switch compare l'icona %.
2. Click su % su un'agenzia senza rapporti aggiuntivi → popup con empty-state e CTA che apre il dialog Rapporti.
3. Click su % su un'agenzia con 1 rapporto → popup mostra direttamente la matrice provvigioni di quel rapporto.
4. Click su % su un'agenzia con ≥2 rapporti → popup con tabs/select, switch tra rapporti ricarica la matrice senza stati residui.
5. La matrice dentro al popup salva/copia/incolla come fa nella pagina dedicata (è lo stesso componente).
