import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export type TourActionType = "navigate" | "scroll" | "wait";

export interface TourAction {
  type: TourActionType;
  target?: string;
  delay?: number;
}

export interface TourStep {
  selector: string;
  title: string;
  description: string;
  page?: string;
  action?: TourAction;
  duration?: number;
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  totalSteps: number;
  startTour: () => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
};

export const CLIENTE_TOUR_STEPS: TourStep[] = [
  // Sidebar
  { selector: "cl-logo", title: "Benvenuto in CBnet! 👋", description: "Questa è la tua Area Clienti: polizze, scadenze, sinistri e documenti del tuo ente, tutto in un solo posto e in tempo reale.", page: "/cliente" },
  { selector: "cl-nav-dashboard", title: "Dashboard 📊", description: "Il tuo punto di partenza: KPI, prossime scadenze, sinistri aperti e premi totali aggiornati in tempo reale.", page: "/cliente" },

  // Dashboard
  { selector: "cl-dash-kpi", title: "Le tue polizze a colpo d'occhio 📈", description: "Polizze attive, premi totali, sinistri aperti e prossime scadenze: i numeri chiave del tuo ente, sempre sincronizzati.", page: "/cliente", action: { type: "navigate", target: "/cliente", delay: 400 } },

  // Polizze
  { selector: "cl-nav-polizze", title: "Le tue Polizze 🛡️", description: "Tutte le polizze del tuo ente: stato, premio, scadenza, ramo e compagnia. Filtra e apri il dettaglio con un click.", page: "/cliente" },
  { selector: "cl-pol-page", title: "Pagina Polizze 🛡️", description: "Qui filtri per stato, ramo, compagnia e data scadenza. Clicca una riga per vedere il dettaglio completo della polizza.", page: "/cliente/polizze", action: { type: "navigate", target: "/cliente/polizze", delay: 500 } },

  // Scadenziario
  { selector: "cl-nav-scadenziario", title: "Scadenziario 📅", description: "Niente più sorprese: vedi cosa scade nei prossimi 30, 60 o 90 giorni e organizza i rinnovi in anticipo.", page: "/cliente" },
  { selector: "cl-scad-page", title: "Le tue Scadenze ⏰", description: "Lista ordinata per data: filtri su finestra temporale, ramo e compagnia. I giorni mancanti sono evidenziati per priorità.", page: "/cliente/scadenze", action: { type: "navigate", target: "/cliente/scadenze", delay: 500 } },

  // Sinistri
  { selector: "cl-nav-sinistri", title: "Sinistri 🚨", description: "Apri una nuova denuncia, allega foto e documenti e segui ogni aggiornamento dal tuo perito direttamente dal portale.", page: "/cliente" },
  { selector: "cl-sin-page", title: "Gestione Sinistri 📋", description: "Stato, riserve, importi liquidati e dettagli per ramo. Apri un sinistro con il pulsante in alto a destra in pochi secondi.", page: "/cliente/sinistri", action: { type: "navigate", target: "/cliente/sinistri", delay: 500 } },

  // Chat
  { selector: "cl-nav-chat", title: "Chat con la tua agenzia 💬", description: "Parla direttamente con i tuoi referenti: una conversazione per ogni polizza, sinistro o argomento. Tutto tracciato.", page: "/cliente" },
  { selector: "cl-chat-page", title: "Le tue Conversazioni 💬", description: "Sulla sinistra l'elenco dei canali, a destra la chat. Niente email perse: tutto in un unico posto sicuro.", page: "/cliente/chat", action: { type: "navigate", target: "/cliente/chat", delay: 500 } },

  // Assistente Polizze (AI) — NEW
  { selector: "cl-nav-assistente", title: "Assistente Polizze ✨", description: "La novità: un assistente AI che conosce TUTTE le tue polizze e risponde alle tue domande in linguaggio naturale.", page: "/cliente" },
  { selector: "cl-assist-page", title: "Chiedi all'AI 🤖", description: "Interroga il tuo intero portafoglio: coperture, massimali, franchigie, esclusioni, scadenze. L'AI consulta sia i dati amministrativi sia le condizioni contrattuali (CGA) analizzate.", page: "/cliente/assistente", action: { type: "navigate", target: "/cliente/assistente", delay: 500 } },
  { selector: "cl-assist-stats", title: "Polizze indicizzate 📚", description: "Il badge mostra quante polizze e quanti set di Condizioni Generali l'assistente sta consultando in tempo reale per rispondere alle tue domande.", page: "/cliente/assistente" },
  { selector: "cl-assist-suggerimenti", title: "Domande di esempio 💡", description: "Non sai da dove iniziare? Clicca uno degli esempi: 'Ho un sinistro: sono coperto?', 'Quali franchigie ho?', 'Ho copertura cyber?' e tante altre.", page: "/cliente/assistente" },
  { selector: "cl-assist-page", title: "Citazione delle fonti 🔖", description: "Ogni risposta cita SEMPRE la polizza di origine tra parentesi quadre, es: [All Risks Property · n° K24IT018712 · AXA XL]. Così sai esattamente da dove arriva l'informazione.", page: "/cliente/assistente" },

  // Documentazione Ente
  { selector: "cl-nav-documenti", title: "Documentazione Ente 📁", description: "L'archivio dei documenti generali del tuo ente: contratti, certificati, allegati. Accesso protetto e privato.", page: "/cliente" },
  { selector: "cl-doc-page", title: "Archivio Documenti 🗂️", description: "Filtra per nome o tipologia, scarica, anteprima e — se l'hai caricato tu — elimina con conferma. Il bucket è privato e cifrato.", page: "/cliente/documenti", action: { type: "navigate", target: "/cliente/documenti", delay: 500 } },
  { selector: "cl-doc-upload", title: "Carica un documento 📤", description: "Trascina o seleziona un file: sarà archiviato nel bucket privato del tuo ente e visibile solo a te e all'agenzia.", page: "/cliente/documenti" },

  // Notifiche
  { selector: "cl-nav-notifiche", title: "Notifiche 🔔", description: "Tutti gli aggiornamenti che ti riguardano: nuove polizze, scadenze, sinistri e messaggi dall'agenzia.", page: "/cliente" },
  { selector: "cl-notif-page", title: "Centro Notifiche 🔔", description: "Le notifiche non lette sono evidenziate. Clicca per leggere e marcarle come viste.", page: "/cliente/notifiche", action: { type: "navigate", target: "/cliente/notifiche", delay: 500 } },

  // Dati Ente
  { selector: "cl-nav-dati", title: "Dati Ente 🏢", description: "Anagrafica completa del tuo ente: ragione sociale, P.IVA, sede, contatti. Da qui richiedi modifiche all'agenzia.", page: "/cliente" },
  { selector: "cl-anag-page", title: "Anagrafica Ente 🏢", description: "Visualizzi tutti i dati ufficiali. Per i campi modificabili puoi inviare una richiesta che l'agenzia approverà.", page: "/cliente/anagrafica", action: { type: "navigate", target: "/cliente/anagrafica", delay: 500 } },

  // Info & Contatti
  { selector: "cl-nav-contatti", title: "Info e Contatti ☎️", description: "Tutto il team dell'agenzia: broker, gestione polizze, sinistri, commerciale e legal con contatti diretti.", page: "/cliente" },
  { selector: "cl-uff-page", title: "Il tuo Team 👥", description: "Sai sempre chi contattare per cosa: ogni reparto con nome, ruolo ed email. Un click e parte la mail.", page: "/cliente/ufficio", action: { type: "navigate", target: "/cliente/ufficio", delay: 500 } },

  // Topbar
  { selector: "cl-topbar-bell", title: "Notifiche rapide 🔔", description: "Il badge sul campanello mostra i messaggi non letti: un click per andare al centro notifiche.", page: "/cliente", action: { type: "navigate", target: "/cliente", delay: 400 } },
  { selector: "cl-topbar-logout", title: "Esci in sicurezza 🔐", description: "Quando hai finito, premi Esci per chiudere la sessione. Per riaprire il tour usa il pulsante ✨ in basso a destra.", page: "/cliente" },

  // Final
  { selector: "cl-logo", title: "Buon lavoro! 🎉", description: "Hai visto tutte le sezioni della tua Area Clienti. Per qualsiasi necessità la tua agenzia è a un click di distanza. A presto!", page: "/cliente" },
];

const STORAGE_KEY = "cbnet_cliente_tour_done";

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = CLIENTE_TOUR_STEPS;

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const stopTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((s) => {
      if (s + 1 >= steps.length) {
        setIsActive(false);
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
        return 0;
      }
      return s + 1;
    });
  }, [steps.length]);

  const prevStep = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), []);

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        totalSteps: steps.length,
        startTour,
        stopTour,
        nextStep,
        prevStep,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const hasSeenClienteTour = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
};
