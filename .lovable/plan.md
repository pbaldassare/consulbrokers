## Obiettivo

Trasformare `Anagrafiche Interne` in una pagina unica chiamata **`Anagrafiche Amministrative`** che raccolga in tab tutte le figure interne all'agenzia + le sedi:

```
Anagrafiche Amministrative
 ├─ Account Executive   (anagrafiche_professionali · tipo=account_executive)   [esistente]
 ├─ Produttori          (anagrafiche_professionali · tipo=corrispondente)      [esistente]
 ├─ Resp. Sede          (anagrafiche_professionali · tipo=responsabile_sede)   [esistente]
 ├─ Specialist          (profiles · ruolo=backoffice)                          [NUOVO tab]
 └─ Sedi                (uffici)                                               [NUOVO tab]
```

Lo Specialist oggi è un **utente di sistema** (`profiles.ruolo='backoffice'`, attualmente 1 attivo, "AC" Admin Consul lo include come admin), non un'anagrafica professionale: lo mostro in sola "vista + stato attivo" leggendo da `profiles`, senza creare una nuova tabella. La gestione completa dell'utente resta su `Sistema → Utenti & Privilegi`.

## Modifiche

### 1. Rinomina pagina
- **`src/pages/AnagraficheInternePage.tsx`** → rinomino in **`AnagraficheAmministrativePage.tsx`**.
- Titolo header: `Anagrafiche Amministrative`
- Sottotitolo: `Figure interne all'agenzia: Account Executive, Produttori, Resp. Sede, Specialist e Sedi`

### 2. Nuovi tab nella TabsList esistente
Estendo `TIPI` (oggi 3 valori) aggiungendo due item gestiti separatamente nel render:
- **Specialist** — tabella read-only (Nome, Cognome, Email, Sede, Stato) con query su `profiles` filtrato per `ruolo IN ('backoffice','admin')` e `attivo=true`. Bottone "Modifica" che apre il pannello utente esistente (`/sistema/utenti/:id`) — niente CRUD locale.
- **Sedi** — riuso integrale del componente `GestioneUfficiPage` come tab embedded (card + tabella uffici già pronti, dialog per creare/modificare). Ne estraggo il body in un componente `SediTabContent` per montarlo qui.

### 3. Route & navigazione
- **`src/routes/archivi.tsx`**: nuova route `/archivi/anagrafiche-amministrative` + redirect da `/archivi/anagrafiche-interne` per non rompere link esistenti.
- **`src/routes/sistema.tsx`**: la route `/gestione-uffici` resta (admin-only) per back-compat, ma diventa secondaria — la gestione primaria delle sedi avviene nel tab.
- **`src/components/AppSidebar.tsx`**: 
  - Voce `Anagrafiche Interne` → rinominata `Anagrafiche Amministrative`, path `/archivi/anagrafiche-amministrative`.
  - Voce `Gestione Sedi` → **rimossa** dal menu (ora è un tab dentro Anagrafiche Amministrative).

### 4. Permessi
- I tab Account Executive / Produttori / Resp. Sede / Specialist: visibili a tutti i livelli che già vedono Anagrafiche Interne.
- Il tab **Sedi** richiede `RoleGuard allowedRoles=["admin"]` (stesso vincolo attuale di `/gestione-uffici`); per gli altri ruoli il tab non viene mostrato.

### 5. Memory
Aggiorno `mem://ui/terminology-conventions` aggiungendo: pagina unica "Anagrafiche Amministrative" raggruppa AE/Produttori/Resp.Sede/Specialist/Sedi.

## File coinvolti

- **Rinominato**: `src/pages/AnagraficheInternePage.tsx` → `src/pages/AnagraficheAmministrativePage.tsx`
- **Nuovo**: `src/components/anagrafiche/SediTabContent.tsx` (estratto dal body di `GestioneUfficiPage`)
- **Nuovo**: `src/components/anagrafiche/SpecialistTabContent.tsx` (lista read-only da `profiles`)
- **Modificati**: `src/routes/archivi.tsx`, `src/routes/sistema.tsx`, `src/components/AppSidebar.tsx`, `src/pages/GestioneUfficiPage.tsx` (refactor per esportare il body riusabile)
- **Memory**: `.lovable/memory/ui/terminology-conventions.md`

## Risultato atteso

Cliccando sulla voce sidebar **Anagrafiche Amministrative** si apre una pagina con 5 tab: i 3 tab esistenti restano identici (CRUD su `anagrafiche_professionali`), il tab **Specialist** mostra la lista degli utenti backoffice, il tab **Sedi** mostra la gestione completa degli uffici (precedentemente in `/gestione-uffici`). La voce separata "Gestione Sedi" sparisce dalla sidebar.
