import { useNavigate } from "react-router-dom";
import {
  FilePlus,
  FileText,
  FileStack,
  FileCheck,
  CalendarCheck,
  ArrowRightLeft,
  DollarSign,
  Clock,
  CheckSquare,
  ClipboardList,
  LucideIcon,
} from "lucide-react";

interface ActionCard {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
}

const actions: ActionCard[] = [
  { label: "Immissione", description: "Inserimento nuova polizza", icon: FilePlus, path: "/portafoglio/immissione" },
  { label: "Appendici", description: "Gestione appendici polizza", icon: FileText, path: "/portafoglio/appendici" },
  { label: "Duplicazione", description: "Duplica polizza esistente", icon: FileStack, path: "/portafoglio/duplicazione" },
  { label: "Conferma Emittende", description: "Conferma emissione polizze", icon: FileCheck, path: "/portafoglio/conferma-emittende" },
  { label: "Rinnovi", description: "Gestione rinnovi polizze", icon: CalendarCheck, path: "/portafoglio/rinnovi" },
  
  { label: "Diff. Provvigionali", description: "Differenze provvigionali", icon: DollarSign, path: "/portafoglio/diff-provvigionali" },
  { label: "Sospensione", description: "Sospensione polizze", icon: Clock, path: "/portafoglio/sospensione" },
  { label: "Riattivazione", description: "Riattivazione polizze sospese", icon: CheckSquare, path: "/portafoglio/riattivazione" },
  { label: "Doc. Precontrattuale", description: "Documentazione precontrattuale", icon: ClipboardList, path: "/portafoglio/doc-precontrattuale" },
];

const GestionePolizzePage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestione Polizze</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seleziona l'operazione da eseguire sulla polizza
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

export default GestionePolizzePage;
