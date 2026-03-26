

## Piano: Sezione Template Email

### Concetto

Creare una sezione **Template** per gestire modelli di email predefiniti con variabili placeholder che attingono dal database (clienti, polizze). Le categorie iniziali sono **Sollecito** e **Rinnovo**. I template supportano variabili come `{{cliente_nome}}`, `{{polizza_numero}}`, `{{polizza_scadenza}}`, ecc. che verranno sostituite con dati reali al momento dell'invio (futuro).

```text
Template "Sollecito pagamento polizza"
  Categoria: sollecito
  Oggetto: Sollecito pagamento polizza {{polizza_numero}}
  Corpo: Gentile {{cliente_nome}} {{cliente_cognome}},
         la informiamo che la polizza n. {{polizza_numero}}
         risulta in scadenza il {{polizza_scadenza}}...
```

### Variabili placeholder disponibili

| Variabile | Fonte |
|---|---|
| `{{cliente_nome}}` | profiles.nome |
| `{{cliente_cognome}}` | profiles.cognome |
| `{{cliente_email}}` | profiles.email |
| `{{cliente_codice_fiscale}}` | profiles.codice_fiscale |
| `{{azienda_ragione_sociale}}` | clienti.ragione_sociale |
| `{{polizza_numero}}` | titoli.numero_titolo |
| `{{polizza_scadenza}}` | titoli.data_scadenza |
| `{{polizza_premio}}` | titoli.premio_lordo |
| `{{compagnia_nome}}` | compagnie.nome |
| `{{sede_nome}}` | uffici.nome_ufficio |
| `{{data_oggi}}` | data corrente |

### Interventi

**1. Migration SQL — 2 tabelle**

- `template_categorie`: id, nome, descrizione, created_at
  - Seed con "Sollecito" e "Rinnovo"
- `template_email`: id, categoria_id (FK), nome, oggetto, corpo (text lungo con placeholder), attivo, created_at, updated_at
  - Seed con 1 template sollecito e 1 template rinnovo di esempio
  - RLS per authenticated users

**2. Nuova pagina `src/pages/TemplatePage.tsx`**

- Layout a due sezioni:
  - **Categorie** (sidebar sinistra o tabs): lista categorie con possibilita di aggiungerne
  - **Template** (area principale): lista template della categoria selezionata
- Per ogni template: nome, oggetto, anteprima corpo troncato, badge attivo/disattivo
- Dialog creazione/modifica template con:
  - Nome template
  - Select categoria
  - Oggetto (input con suggerimento variabili)
  - Corpo (textarea grande con barra variabili cliccabili per inserirle)
  - Switch attivo/disattivo
- Anteprima template con dati di esempio
- Eliminazione template

**3. Sidebar + Route**

- Aggiungere voce "Template" nel menu laterale (icona `FileText` o `Mail`)
- Route `/template` in `sistema.tsx`

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| Tabelle | `template_categorie`, `template_email` |
| Seed | 2 categorie + 2 template di esempio con placeholder realistici |
| File nuovi | `src/pages/TemplatePage.tsx` |
| File modificati | `AppSidebar.tsx`, `src/routes/sistema.tsx`, `types.ts` |
| Variabili | Inserite nel corpo tramite bottoni cliccabili, sostituite lato app al momento dell'uso |

