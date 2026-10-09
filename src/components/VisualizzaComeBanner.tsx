import { useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  esciVisualizzaCome,
  parseVisualizzaCome,
  snapshotVisualizzaCome,
  subscribeVisualizzaCome,
} from "@/lib/visualizzaCome";

/** Banner in alto finché admin@consul.it sta usando CBnet come un altro utente. Va montato dentro il Router. */
export default function VisualizzaComeBanner() {
  const raw = useSyncExternalStore(subscribeVisualizzaCome, snapshotVisualizzaCome);
  const stato = parseVisualizzaCome(raw);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [uscendo, setUscendo] = useState(false);
  if (!stato) return null;

  const esci = async () => {
    setUscendo(true);
    const ok = await esciVisualizzaCome();
    qc.clear(); // niente dati dell'utente visualizzato rimasti in cache
    setUscendo(false);
    if (ok) {
      navigate("/utenti-privilegi", { replace: true });
    } else {
      toast.error("Sessione admin scaduta: rientra con le tue credenziali");
      navigate("/login", { replace: true });
    }
  };

  return (
    <div
      role="status"
      className="fixed left-1/2 top-2 z-[200] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-fuchsia-700 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-lg ring-2 ring-white/70"
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        <strong>Visualizza come</strong> {stato.nome}
        <span className="hidden opacity-80 sm:inline"> · {stato.email}</span>
      </span>
      <button
        type="button"
        disabled={uscendo}
        onClick={esci}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-fuchsia-800 hover:bg-fuchsia-50 disabled:opacity-70"
      >
        {uscendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Esci
      </button>
    </div>
  );
}
