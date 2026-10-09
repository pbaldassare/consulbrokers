import { useState } from "react";
import { Eye, Loader2, LogOut } from "lucide-react";
import { esciVisualizzaCome, leggiVisualizzaCome } from "@/lib/visualizzaCome";

/** Barra fissa in fondo allo schermo finché admin@consul.it sta visualizzando CBnet come un altro utente. */
export default function VisualizzaComeBanner() {
  const [stato] = useState(leggiVisualizzaCome);
  const [uscendo, setUscendo] = useState(false);
  if (!stato) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-3 bg-fuchsia-700 px-4 py-2 text-sm text-white shadow-[0_-4px_16px_rgba(0,0,0,0.25)]"
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Modalità <strong>Visualizza come</strong>: stai usando CBnet come <strong>{stato.nome}</strong> ({stato.email}).
        Ogni azione è fatta a suo nome.
      </span>
      <button
        type="button"
        disabled={uscendo}
        onClick={() => {
          setUscendo(true);
          void esciVisualizzaCome();
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs font-semibold text-fuchsia-800 hover:bg-fuchsia-50 disabled:opacity-70"
      >
        {uscendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Esci e torna admin
      </button>
    </div>
  );
}
