## Obiettivo
Uniformare la terminologia "Consul" in tutto il modulo clienti e ripulire residui legacy.

## Modifiche

### 1. `src/components/clienti/NuovoClienteDialog.tsx`
- Sezione "Produttore" (riga ~1004) → rinominare label in **"Consul"** (placeholder `Seleziona Consul...`).
- Aggiornare commenti residui (`{/* Produttore: ... */}`, `{/* Specialist: ... */}`) per coerenza.
- Pulire la query `profili_commerciali_lookup` (riga 263) rimuovendo i ruoli legacy `responsabile_sede`, `executive`, `produttore` dal filtro `.in("ruolo", [...])`, mantenendo solo `admin`, `produttore_sede`, `backoffice`, `account_executive`.

### 2. `src/pages/ClienteDetail.tsx`
- Allineare la query `profili_commerciali_rete` (riga 411) allo stesso filtro pulito.
- Già OK: label "Consul" presente, nessun campo legacy residuo.

### 3. Verifica finale
- `rg` su `mandato|brand|società|provvigione|altro_broker|scadenza_mandato|data_disdetta|termine_proroga` in `src/pages/ClienteDetail.tsx` e `src/components/clienti/` per confermare zero residui UI.

## Fuori scope
- Nessuna migrazione DB.
- Logica di salvataggio invariata (già `profilo_id + ruolo`).
