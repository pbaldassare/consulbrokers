import { useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  DollarSign,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  Archive,
  LucideIcon,
} from "lucide-react";

interface ActionCard {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
}

const actions: ActionCard[] = [
  { label: "Portafoglio per Cliente", description: "Estrazione portafoglio raggruppato per cliente", icon: Users, path: "/portafoglio/estrazioni/per-cliente" },
  { label: "Portafoglio per Agenzia", description: "Estrazione portafoglio raggruppato per agenzia", icon: Building2, path: "/portafoglio/estrazioni/per-compagnia" },
  { label: "Premi e Provvigioni", description: "Stampa riepilogo premi e provvigioni", icon: DollarSign, path: "/portafoglio/estrazioni/premi-provvigioni" },
  { label: "Premi Scoperti e Garantiti", description: "Report premi scoperti e garantiti", icon: ShieldCheck, path: "/portafoglio/estrazioni/premi-scoperti-garantiti" },
  { label: "E/C Clienti", description: "Estratto conto clienti", icon: FileSpreadsheet, path: "/portafoglio/estrazioni/ec-clienti" },
  { label: "E/C Agenzie", description: "Estratto conto verso agenzie con anteprima, stampa e archivio", icon: FileText, path: "/contabilita/ec-agenzia" },
  { label: "Storico E/C Agenzie", description: "PDF E/C Agenzie archiviati: ricerca, filtri e anteprima", icon: Archive, path: "/contabilita/ec-agenzia/storico" },
  { label: "Storico E/C Clienti", description: "PDF E/C Clienti archiviati: ricerca per cliente, periodo e download", icon: Archive, path: "/contabilita/ec-cliente/storico" },
];

const EstrazioniStampePage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estrazioni e Stampe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seleziona il tipo di estrazione o stampa da generare
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {actions.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-center group"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <action.icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default EstrazioniStampePage;
