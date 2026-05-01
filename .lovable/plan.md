
## Obiettivi

1. **Rinomina tab "Timeline" → "Log Attività"** in `ClienteDetail.tsx` e ovunque sia visibile lato cliente, mantenendo il componente `TimelineTab` (solo label cambia) per non rompere altri usi.
2. **Log Attività aggregato** sul cliente: oltre ai log di `entita_tipo='cliente'`, includere automaticamente i log di **tutte le polizze, sinistri e trattative collegate** a quel cliente.
3. **Chat persistente + collegamenti corretti**: il canale è già salvato su `chat_canali` (quindi già persistente lato DB), ma serve **sincronizzare i membri** ad ogni apertura per includere produttori/specialist/commerciali assegnati dopo la creazione, e mostrare il **roster visibile** dei partecipanti.

---

## Modifiche tecniche

### 1) `src/pages/ClienteDetail.tsx`
- Riga 1547: cambiare label `Timeline` → `Log Attività` (icona resta `Activity` o equivalente).
- Caricare gli ID delle entità collegate al cliente (lo facciamo già per `polizze`, aggiungere fetch leggera per `sinistri.id` e `trattative.id` filtrate per cliente).
- Passare a `<TimelineTab>` la prop `extraEntities` già supportata:
  ```tsx
  <TimelineTab
    entitaTipo="cliente"
    entitaId={id!}
    extraEntities={[
      { tipo: "titolo",    ids: polizze.map(p => p.id) },
      { tipo: "sinistro",  ids: sinistriIds },
      { tipo: "trattativa", ids: trattativeIds },
    ]}
  />
  ```
- Nessuna modifica al componente `TimelineTab` (già pronto a unire log multi-entità e ordinarli per data).

### 2) `src/components/ChatTab.tsx` — sync membri ad ogni apertura
Attualmente i membri vengono aggiunti **solo alla creazione del canale**. Aggiungere un secondo `useQuery`/effetto che, quando `canaleId` esiste:
- Ricalcola `findAllRelatedUsers(entitaTipo, entitaId)`.
- Confronta con `chat_canali_membri` esistenti (per quel canale).
- **Inserisce solo i nuovi** (upsert con `onConflict: 'canale_id,user_id'`, ignora errori di duplicato).
- Non rimuove mai membri storici (preserva la storia conversazionale).

Mostrare un piccolo **roster header** sopra la chat: avatar/iniziali + nome + ruolo (cliente / produttore / specialist / staff sede). Click su un membro → tooltip con ruolo. Questo rende esplicito il "collegamento al produttore/specialist".

### 3) `src/lib/findRelatedUsers.ts` — nessuna modifica strutturale
La funzione già copre per il cliente:
- `cliente.user_id`
- `codici_commerciali_cliente.profilo_id` con ruoli AE / corrispondente_1/2/3 / agente / executive (= **Specialist + produttori commerciali**)
- staff dell'ufficio (admin/ufficio/produttore/backoffice/contabilita/cfo)

Verificare solo che il filtro `addUfficioStaff` includa effettivamente i ruoli in uso oggi (es. `responsabile_sede`). Se manca, aggiungerlo all'array `.in("ruolo", [...])`.

### 4) DB — nessuna migrazione necessaria
- `chat_canali` e `chat_canali_membri` esistono già con vincolo unique implicito (o aggiungibile) su `(canale_id, user_id)`. Verifico in fase build; se il vincolo non c'è, aggiungo migrazione `ALTER TABLE chat_canali_membri ADD CONSTRAINT chat_canali_membri_unique UNIQUE (canale_id, user_id)` per consentire upsert sicuro.
- Il logging via `logAttivita()` è già attivo su tutte le entità (cliente, titoli, sinistri, trattative) → l'aggregazione sul tab Log Attività mostrerà già la cronologia esistente senza altri interventi.

### 5) `public/version.json`
Bump versione.

---

## Risposte alle tue domande / chiarimenti

- **Persistenza chat**: già garantita oggi (canale + messaggi salvati su Postgres). Ciò che cambia è la **sincronizzazione automatica dei membri** ad ogni apertura, così se aggiungi un nuovo Specialist o cambi produttore lui entra nel canale senza dover ricreare nulla.
- **Collegamento produttore / specialist**: avviene automaticamente perché sono già in `codici_commerciali_cliente` (Specialist = `backoffice` o ruoli AE/corrispondente) o in `profiles.ufficio_id` della Sede del cliente. Il nuovo roster header li renderà visibili.
- **Log delle attività di polizze**: oggi vengono scritte con `entita_tipo='titolo'`. Aggregandole nel tab cliente vedrai nella stessa timeline: modifiche cliente, emissioni polizze, messa a cassa, sinistri aperti, trattative ecc.

---

## File toccati

- `src/pages/ClienteDetail.tsx` (label tab + fetch ids + extraEntities)
- `src/components/ChatTab.tsx` (sync membri + roster header)
- `src/lib/findRelatedUsers.ts` (solo se manca un ruolo nello staff query)
- `public/version.json`
- (eventuale) migrazione SQL per `UNIQUE(canale_id,user_id)` se non già presente

**Confermi?**
