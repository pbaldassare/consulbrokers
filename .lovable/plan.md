

## Piano: Ristrutturare Sidebar e Pagine secondo menu AWB.net

### Struttura menu da implementare (dalle immagini di riferimento)

```text
HOME (Dashboard)
ARCHIVI
  ├── Anagrafiche Clienti
  ├── Compagnie
  ├── Categorie
  ├── Prodotti
PORTAFOGLIO
  ├── Ricerca Polizze (→ /titoli esistente)
  ├── Gestione Polizze (→ /titoli esistente, stesso)
  ├── Estrazioni e Stampe (nuovo placeholder)
  ├── Collettive/Libri Matricola (nuovo placeholder)
  ├── Regolazioni (nuovo placeholder)
  ├── Documentale (nuovo placeholder)
  ├── Trattative (→ /trattative esistente)
  ├── Rientro Documenti (nuovo placeholder)
  ├── Import Titoli (Excel) (nuovo placeholder)
SINISTRI
  ├── Ricerca (→ /sinistri esistente)
  ├── Apertura (nuovo placeholder)
  ├── Prescrizioni (nuovo placeholder)
  ├── Scadenze (nuovo placeholder)
  ├── Report Sanitario SIR (nuovo placeholder)
CONTABILITÀ
  ├── Incassi e Coperture (→ /contabilita esistente)
  ├── Avvisi Incasso (nuovo placeholder)
  ├── Chiusura Giornaliera (nuovo placeholder)
  ├── E/C Clienti (nuovo placeholder)
  ├── E/C Compagnia (nuovo placeholder)
  ├── E/C Produttori (nuovo placeholder)
  ├── Stampa Primanota (nuovo placeholder)
  ├── Check Primanota (nuovo placeholder)
  ├── Stampa Sospesi (nuovo placeholder)
CONT. GENERALE
  ├── Anagrafiche (nuovo placeholder)
  ├── Primanota (nuovo placeholder)
  ├── Elab. Periodiche (nuovo placeholder)
  ├── Fornitori (nuovo placeholder)
  ├── Clienti (nuovo placeholder)
  ├── Elab. Annuali (nuovo placeholder)
  ├── Dichiarativi (nuovo placeholder)
FATTURAPA
  ├── Anagrafiche (nuovo placeholder)
  ├── Gestione (nuovo placeholder)
  ├── Estrazione XML (→ /backup-export esistente)
  ├── Intermediazione (nuovo placeholder)
  ├── Import Fatture Acquisto (nuovo placeholder)
```

Plus le sezioni admin/sistema esistenti (Impostazioni, Gestione Utenti, ecc.) rimangono in fondo.

### Interventi

1. **Ristrutturare `AppSidebar.tsx`** - Trasformare la lista piatta in gruppi collassabili (usando un semplice state toggle per gruppo). Ogni gruppo ha titolo e sotto-voci con indentazione. Struttura dati: array di `SidebarGroup` con `label`, `icon`, `children: SidebarItem[]`.

2. **Aggiungere rotte in `App.tsx`** - Creare le rotte per tutte le nuove sotto-pagine che puntano a `PlaceholderPage` con titolo/descrizione/icona appropriati. Le pagine già esistenti mantengono il loro componente.

3. **Nessuna nuova pagina custom** per ora - Tutte le nuove voci usano `PlaceholderPage` con titoli e icone appropriate. Le pagine già implementate (Titoli, Sinistri, Contabilità, ecc.) vengono riusate.

### File coinvolti
- **Modificato**: `src/components/AppSidebar.tsx` (sidebar a gruppi collassabili)
- **Modificato**: `src/App.tsx` (nuove rotte placeholder)

### Dettagli tecnici

**AppSidebar**: La struttura dati diventa:
```typescript
interface SidebarGroup {
  label: string;
  icon: LucideIcon;
  permissionKey: string;
  children: SidebarItem[];
}
```
Ogni gruppo ha uno state `openGroups: Set<string>` per toggle apertura/chiusura. Il gruppo attivo (che contiene la rotta corrente) si apre automaticamente.

**Rotte**: Circa 25 nuove rotte placeholder, tutte sotto il layout autenticato esistente. Path pattern: `/portafoglio/estrazioni-stampe`, `/sinistri/apertura`, `/contabilita/avvisi-incasso`, `/cont-generale/primanota`, `/fatturapa/gestione`, ecc.

