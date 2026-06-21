## Obiettivo
Aggiungere accanto allo Switch Attiva/Disattiva in `/compagnie` un pulsante icona **%** che apre un popup con le provvigioni dell'agenzia per rapporto, riusando il componente esistente `ProvvigioniRapportiTab`. Aggiungere un piccolo indicatore di stato "configurato/vuoto" per ogni rapporto, dato che oggi solo 4 rapporti su 25 hanno righe in `provvigioni_compagnia_ramo`.

## Stato attuale dei dati (verificato)
Rapporti con righe configurate in `provvigioni_compagnia_ramo`:
- Euroconsulting Srl → Unipol (36), Axa (19), Dual (1)
- etisicura test → allianz roma (11)

Tutti gli altri 21 rapporti attivi hanno 0 righe: nel popup compariranno con matrice vuota da popolare (manuale / IA / CSV / copia da altro rapporto — già presenti in `ProvvigioniRapportiTab`).

## Modifiche

### 1. Nuovo `src/components/compagnie/ProvvigioniCompagniaDialog.tsx`
Props: `open`, `onOpenChange`, `compagniaId`, `compagniaNome`, `onOpenRapporti`.
Comportamento:
- Carica `compagnia_rapporti` (attivi) per `compagnia_id` + per ognuno conta righe attive in `provvigioni_compagnia_ramo` (singola query con join o due query parallele in `useQuery`).
- **0 rapporti** → empty state con icona `Network` + CTA "Apri Rapporti" che chiude il dialog e apre `RapportiCompagniaDialog`.
- **1 rapporto** → header con nome rapporto + badge "Configurato (N righe)" o "Vuoto", poi `<ProvvigioniRapportiTab fixedRapportoId={...} />`.
- **≥2 rapporti** → Tabs (≤4) o `SearchableSelect` (>4). Ogni tab/option mostra nome rapporto e un piccolo badge ✓ (N) o ○ vuoto. Sotto: `<ProvvigioniRapportiTab fixedRapportoId={selectedRapportoId} key={selectedRapportoId} />` (key forza remount).
- Dialog `max-w-7xl max-h-[90vh] overflow-hidden`.

### 2. `src/pages/CompagnieList.tsx`
- Nuovo state `provvigioniTarget: { id, nome } | null`.
- In cella Switch (agenzie), aggiungo bottone icona `Percent` prima dello Switch:
  ```tsx
  <Button variant="ghost" size="icon" className="h-8 w-8" title="Provvigioni"
    onClick={() => setProvvigioniTarget({ id: c.id, nome: c.nome })}>
    <Percent className="w-4 h-4" />
  </Button>
  ```
- Monto `<ProvvigioniCompagniaDialog>` con `onOpenRapporti` che chiude questo dialog e apre `RapportiCompagniaDialog` con la stessa agenzia.

## Cosa NON cambio
- Niente modifiche a schema DB, RLS, edge functions.
- Niente modifiche a `ProvvigioniRapportiTab` (riusato in modalità `fixedRapportoId`).
- Form "Modifica Agenzia" resta a 3 tab puliti (memoria `compagnie-form-pulita`).
- Pagina `/provvigioni-compagnie-ramo` resta intatta.

## Verifica
1. Click % su Euroconsulting → popup con 3 tab (Unipol ✓36, Axa ✓19, Dual ✓1) + Tabs/Select.
2. Click % su agenzia con 1 rapporto vuoto (es. Angiulli) → matrice vuota con CTA import IA/CSV/copia, badge "Vuoto".
3. Click % su agenzia senza rapporti → empty state con CTA "Apri Rapporti".
4. Switch tra rapporti ricarica la matrice senza stati residui (key).
