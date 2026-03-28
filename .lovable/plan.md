

## Piano: Creare la pagina Sitemap (organigramma ruoli e privilegi)

### Obiettivo
Creare una pagina visuale `/sitemap` accessibile solo agli admin che mostra l'organigramma completo del sistema: ruoli, gerarchie, permessi, e tutte le sezioni/pagine raggruppate per area con indicazione di chi vi accede.

### Struttura della pagina

La pagina sarà organizzata in 3 sezioni principali:

**Sezione 1 — Gerarchia Ruoli** (cards colorate con icone)
Piramide visiva dei 7 ruoli del sistema, ognuno con una card che descrive mansioni e accessi:

| Ruolo | Livello | Descrizione |
|-------|---------|-------------|
| **Admin** | 1 (top) | Accesso totale. Gestione utenti, sedi, compagnie, tabelle base, backup, manutenzione, template, impostazioni. Tutti i permessi sono implicitamente attivi. |
| **CFO** | 2 | Area finanziaria e contabilità generale. Piano dei conti, primanota, scadenziario, elaborazioni periodiche/annuali, dichiarativi, import bancario, anomalie sistema. |
| **Ufficio** | 2 | Gestione operativa della sede. Clienti, portafoglio, sinistri, contabilità ufficio, impostazioni sede, template email. Visibilità su tutti i dati della sede assegnata. |
| **Contabilità** | 3 | Contabilità ufficio: incassi, distinta giornaliera, quadratura premi, chiusura contabile, E/C clienti/compagnie/produttori, FatturaPA. |
| **Produttore** | 3 | Visibilità limitata alla propria produzione. Dashboard, prospect, trattative, portafoglio proprio, provvigioni proprie. |
| **Backoffice** | 3 | Supporto operativo. Gestione clienti, polizze, sinistri, comunicazioni. Opera come Specialist/Executive sui clienti assegnati. |
| **Cliente** | 4 (esterno) | Portale dedicato separato. Vede solo le proprie polizze, documenti, scadenze, sinistri, pagamenti. Nessun accesso al gestionale interno. |

**Sezione 2 — Mappa delle Sezioni** (griglia di card espandibili)
Ogni area del sistema con le sue pagine e i ruoli che vi accedono:

- Home / Dashboard
- Archivi (Clienti, Anagrafiche)
- Prospect / Trattative
- Portafoglio (9 sotto-pagine)
- Sinistri (5 sotto-pagine)
- Contabilità (12 sotto-pagine)
- Cont. Generale (9 sotto-pagine)
- FatturaPA (4 sotto-pagine)
- Sistema (10 sotto-pagine, admin only)
- Area CFO, Provvigioni, Rimessa Premi
- Portale Cliente (9 pagine, ruolo cliente)

Ogni pagina mostra i ruoli autorizzati con badge colorati.

**Sezione 3 — Permessi JSON** (tabella riassuntiva)
Lista di tutte le chiavi `permessi_json` e a quali sezioni corrispondono:
`dashboard`, `titoli`, `sinistri`, `contabilita`, `cfo_area`, `impostazioni`, `provvigioni`, `rimessa_premi`

### Dettagli tecnici

**File da creare:**
- `src/pages/SitemapPage.tsx` — componente React con layout a card, griglia responsive, badge colorati per ruolo, sezioni collapsibili

**File da modificare:**
- `src/routes/sistema.tsx` — aggiungere route `/sitemap` con `RoleGuard allowedRoles={["admin"]}`
- `src/components/AppSidebar.tsx` — aggiungere voce "Sitemap" nel gruppo Sistema con icona `Map`

### Design
- Card con bordo colorato per ogni ruolo (colori distinti per livello gerarchico)
- Badge per i ruoli su ogni pagina
- Layout responsive a griglia
- Sezioni espandibili per i gruppi di pagine
- Stile coerente con il resto dell'app (Tailwind + shadcn)

