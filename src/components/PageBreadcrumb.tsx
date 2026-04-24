import { useLocation, useNavigate } from "react-router-dom";
import { Home, ChevronLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

const ROUTE_LABELS: Record<string, string> = {
  "": "Home",
  "prospect": "Prospect",
  "trattative": "Trattative",
  "archivi": "Archivi",
  "clienti": "Clienti",
  "anagrafiche": "Anagrafiche Professionali",
  "compagnie": "Compagnie / Agenzie",
  "categorie": "Categorie",
  "prodotti": "Prodotti",
  "portafoglio": "Portafoglio",
  "gestione-polizze": "Gestione Polizze",
  "immissione": "Immissione",
  "appendici": "Appendici",
  "duplicazione": "Duplicazione",
  "conferma-emittende": "Conferma Emittende",
  "rinnovi": "Rinnovi",
  "storno": "Storno",
  "diff-provvigionali": "Diff. Provvigionali",
  "sospensione": "Sospensione",
  "riattivazione": "Riattivazione",
  "doc-precontrattuale": "Doc. Precontrattuale",
  "estrazioni-stampe": "Estrazioni e Stampe",
  "estrazioni": "Estrazioni",
  "per-cliente": "Per Cliente",
  "per-compagnia": "Per Compagnia",
  "premi-provvigioni": "Premi e Provvigioni",
  "premi-scoperti-garantiti": "Premi Scoperti e Garantiti",
  "ec-clienti": "E/C Clienti",
  "collettive": "Collettive",
  "regolazioni": "Regolazioni",
  "documentale": "Documentale",
  "rientro-documenti": "Rientro Documenti",
  "import-titoli": "Import Titoli",
  "titoli": "Titoli",
  "sinistri": "Sinistri",
  "apertura": "Apertura",
  "prescrizioni": "Prescrizioni",
  "scadenze": "Scadenze",
  "report-sir": "Report SIR",
  "contabilita": "Contabilità",
  
  "chiusura-giornaliera": "Chiusura Giornaliera",
  "ec-compagnia": "E/C Compagnia",
  "ec-produttori": "E/C Produttori",
  "stampa-primanota": "Stampa Primanota",
  "check-primanota": "Check Primanota",
  "stampa-sospesi": "Stampa Sospesi",
  "cont-generale": "Contabilità Generale",
  "primanota": "Primanota",
  "elab-periodiche": "Elab. Periodiche",
  "fornitori": "Fornitori",
  "causali": "Causali/Tabelle",
  "scadenziario": "Scadenziario",
  "import-bancario": "Import Bancario",
  "elab-annuali": "Elab. Annuali",
  "dichiarativi": "Dichiarativi",
  "fatturapa": "FatturaPA",
  "gestione": "Gestione",
  "intermediazione": "Intermediazione",
  "import-fatture": "Import Fatture",
  "cfo": "Area CFO",
  
  "rimessa-premi": "Rimessa Premi",
  "banca-import": "Import Banca",
  "anomalie-ko": "Anomalie KO",
  "note-restituzione": "Note Restituzione",
  "spedizioni": "Spedizioni",
  "notifiche": "Notifiche",
  "privacy": "Privacy e Consensi",
  "report-iva": "Report IVA",
  "flussi-compagnie": "Flussi Compagnie",
  "pagamenti-provvigioni": "Pagamenti Provvigioni",
  "report": "Report",
  "comunicazioni": "Comunicazioni",
  "impostazioni": "Impostazioni",
  "crea-utente": "Crea Utente",
  "gestione-utenti": "Gestione Utenti",
  "backup-export": "Backup & Export",
  "manutenzione": "Manutenzione",
  "tabelle-base": "Tabelle di Base",
  "anomalie-sistema": "Anomalie Sistema",
  "login": "Login",
  "reset-password": "Reset Password",
};

// Check if segment looks like a UUID
const isUuid = (s: string) => /^[0-9a-f]{8}-/.test(s);

const PageBreadcrumb = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show on home
  if (location.pathname === "/") return null;

  const segments = location.pathname.split("/").filter(Boolean);

  // Build cumulative paths
  const crumbs = segments
    .map((seg, i) => ({
      label: isUuid(seg) ? "Dettaglio" : (ROUTE_LABELS[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())),
      path: "/" + segments.slice(0, i + 1).join("/"),
      isLast: i === segments.length - 1,
    }));

  return (
    <div className="flex items-center gap-3 mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/")}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <Home className="w-4 h-4 mr-1" />
        Home
      </Button>

      <div className="h-4 w-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Indietro
      </Button>

      <div className="h-4 w-px bg-border" />

      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="cursor-pointer"
                    onClick={() => navigate(crumb.path)}
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default PageBreadcrumb;
