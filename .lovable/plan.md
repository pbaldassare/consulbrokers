
## Domanda dell'utente

"Come creo una nuova polizza?" — domanda di **navigazione/uso**, non di implementazione. L'utente sta cercando il punto di accesso al form di creazione polizza che abbiamo appena rifatto.

## Risposta diretta

L'utente è su `/portafoglio/attive`. Il form di immissione polizza è disponibile a `/portafoglio/immissione` (route confermata in `src/routes/portafoglio.tsx`).

Spiego:
1. **Dove cliccare**: dal menu laterale → Portafoglio → Immissione Polizza, oppure URL diretto
2. **Cosa serve compilare** (sezioni del form appena rifatto):
   - Cliente (esistente o nuovo via "+ Nuovo Cliente")
   - Sede / Produttore / Specialist (auto-popolati dal cliente)
   - Compagnia, Ramo, Prodotto
   - Numero polizza, periodo, importi
   - Sezione RCA Auto se il ramo è RCA (marca/modello/targa/CU)
3. **Dopo il salvataggio**: redirect a `/titoli/:id` con primo movimento PI creato

## Verifica veloce

Confermo che la route esiste già e che il form è quello aggiornato. Nessuna modifica al codice necessaria — è solo guida.

Se l'utente non vede la voce di menu, verifichiamo `AppSidebar.tsx`. Ma la risposta primaria è solo istruzioni di navigazione, quindi NESSUN piano di build necessario.

→ Rispondo direttamente in chat senza piano (è una Q&A pura).
