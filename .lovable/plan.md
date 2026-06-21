## Regola (da memoria)

- La **polizza** (madre, `sostituisce_polizza IS NULL`) è il contratto: **non** si mette a cassa, niente `data_messa_cassa`/`data_incasso`.
- Le **quietanze** (`sostituisce_polizza = numero_titolo`) sono generate in automatico dal trigger `genera_quietanze_su_insert_madre` in base a frazionamento × durata.
- Solo le quietanze si mettono a cassa.
- **Annuale 1 anno → 1 polizza + 1 quietanza**. Etichetta: "Quietanza 1/1".

Verifica in DB sulla polizza appena creata `12345` (Paolo Baldassare): ✔ 1 madre + 1 quietanza. Il dato è corretto, è solo la UI che mostra "Quietanza 2/2" e totale premio raddoppiato.

## Fix UI (nessun cambio dati o trigger)

### 1. Etichetta rata in `PolizzeClienteTable`
File: `src/pages/ClienteDetail.tsx` (riga ~1032 in poi) + helper di raggruppamento in `src/lib/`.

Per ogni catena `numero_titolo`:
- record con `sostituisce_polizza IS NULL` → **Polizza**
- record con `sostituisce_polizza IS NOT NULL` → numerati `1..N` su N = numero di figli (la madre **non** entra nel conteggio)
- Annuale 1y → "Quietanza 1/1" (oggi mostra 2/2)

### 2. Totale premio nella barra "X polizze · Y quietanze · totale premio …"
Sommare `premio_lordo` solo dei record quietanza (figli), **escludendo** la madre. Per annuale 1y il totale tornerà 1.222,50 € invece di 2.445,00 €.

### 3. Filtro segmentato "Tutti / Polizze / Quietanze"
I contatori principali (1 polizza, 1 quietanza) sono già giusti. Verifico solo che le righe filtrate corrispondano.

## Fuori scopo
- Schema DB, trigger di generazione quietanze, RLS, modello polizze/titoli/quietanze: invariati.
- Logica messa a cassa, provvigioni, rimesse, EC: invariata.
- Altre viste portafoglio (Attive/Carico/Storico): se mostrano lo stesso bug le includo in un secondo passaggio mirato, su richiesta.

## Verifica finale
1. Ricarico `/archivi/clienti/2249f5de…?tab=polizze` → riga figlia = "Quietanza 1/1".
2. Riepilogo: `1 polizze · 1 quietanze · totale premio € 1.222,50`.
3. Caso mentale: semestrale 1y → "1/2" e "2/2", totale = somma delle 2 quietanze.