import { useState } from "react";
import {
  Shield, Users, Building2, Calculator, Briefcase, Headphones, UserCircle,
  ChevronDown, ChevronRight, LayoutDashboard, FileText, AlertTriangle,
  BarChart3, Settings, Send, FolderOpen, Landmark, Bell, Package,
  ClipboardList, Clock, Receipt, Lock, Map
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/* ─── RUOLI ─── */
const ruoli = [
  {
    nome: "Admin",
    livello: 1,
    icon: Shield,
    color: "border-red-500 bg-red-50 dark:bg-red-950/30",
    badgeColor: "bg-red-500 text-white",
    descrizione: "Accesso totale al sistema. Gestisce utenti, sedi, compagnie, tabelle base, backup, manutenzione, template e impostazioni. Tutti i permessi sono implicitamente attivi.",
    mansioni: [
      "Creazione e gestione utenti interni",
      "Configurazione sedi e compagnie",
      "Gestione tabelle di base e parametri",
      "Backup, export dati e manutenzione",
      "Template email e comunicazioni",
      "Visibilità totale su tutti i dati di tutte le sedi",
      "Accesso a tutte le aree senza restrizioni",
    ],
  },
  {
    nome: "CFO",
    livello: 2,
    icon: BarChart3,
    color: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    badgeColor: "bg-amber-500 text-white",
    descrizione: "Area finanziaria e contabilità generale. Supervisione economico-finanziaria dell'agenzia.",
    mansioni: [
      "Piano dei conti e primanota generale",
      "Scadenziario e gestione fornitori",
      "Elaborazioni periodiche e annuali",
      "Dichiarativi e certificazioni CU",
      "Import bancario e riconciliazione",
      "Anomalie sistema",
      "Report e analisi finanziarie",
    ],
  },
  {
    nome: "Ufficio",
    livello: 2,
    icon: Building2,
    color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    badgeColor: "bg-blue-500 text-white",
    descrizione: "Gestione operativa della sede assegnata. Visibilità completa su clienti, portafoglio, sinistri e contabilità della propria sede.",
    mansioni: [
      "Gestione completa clienti e prospect",
      "Portafoglio polizze (immissione, rinnovi, storni, appendici)",
      "Gestione sinistri",
      "Contabilità di ufficio e distinta giornaliera",
      "Impostazioni sede e template email",
      "Comunicazioni e spedizioni",
      "Trattative e preventivi",
    ],
  },
  {
    nome: "Contabilità",
    livello: 3,
    icon: Calculator,
    color: "border-green-500 bg-green-50 dark:bg-green-950/30",
    badgeColor: "bg-green-500 text-white",
    descrizione: "Operatività contabile dell'ufficio. Gestione incassi, quadrature e rendicontazione.",
    mansioni: [
      "Distinta giornaliera e cruscotto",
      "Quadratura premi e chiusura contabile",
      "E/C clienti, compagnie e produttori",
      "Contabilità ufficio completa",
      "Gestione FatturaPA (emissione, ricezione)",
    ],
  },
  {
    nome: "Produttore",
    livello: 3,
    icon: Briefcase,
    color: "border-purple-500 bg-purple-50 dark:bg-purple-950/30",
    badgeColor: "bg-purple-500 text-white",
    descrizione: "Visibilità limitata alla propria produzione. Accede solo ai dati relativi ai clienti e polizze a lui assegnati.",
    mansioni: [
      "Dashboard con KPI personali",
      "Prospect e trattative proprie",
      "Portafoglio polizze assegnate",
      "Provvigioni personali",
      "Comunicazioni relative ai propri clienti",
    ],
  },
  {
    nome: "Backoffice",
    livello: 3,
    icon: Headphones,
    color: "border-teal-500 bg-teal-50 dark:bg-teal-950/30",
    badgeColor: "bg-teal-500 text-white",
    descrizione: "Supporto operativo quotidiano. Opera come Specialist/Executive sui clienti assegnati alla sede.",
    mansioni: [
      "Gestione clienti e anagrafiche",
      "Lavorazione polizze e sinistri",
      "Comunicazioni e spedizioni",
      "Caricamento documenti",
      "Supporto alla rete commerciale",
    ],
  },
  {
    nome: "Cliente",
    livello: 4,
    icon: UserCircle,
    color: "border-gray-400 bg-gray-50 dark:bg-gray-900/30",
    badgeColor: "bg-gray-500 text-white",
    descrizione: "Portale dedicato separato dal gestionale interno. Accesso limitato ai propri dati personali.",
    mansioni: [
      "Visualizzazione polizze attive e scadute",
      "Documenti personali e contrattuali",
      "Scadenze e pagamenti",
      "Apertura e monitoraggio sinistri",
      "Upload documenti per la propria pratica",
      "Comunicazioni con l'agenzia",
    ],
  },
];

/* ─── SEZIONI ─── */
const sezioni = [
  {
    area: "Home",
    icon: LayoutDashboard,
    pagine: [
      { nome: "Dashboard", ruoli: ["admin", "cfo", "ufficio", "contabilita", "produttore", "backoffice"] },
    ],
  },
  {
    area: "Archivi",
    icon: FolderOpen,
    pagine: [
      { nome: "Clienti", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
      { nome: "Dettaglio Cliente", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
      { nome: "Anagrafiche Professionali", ruoli: ["admin", "ufficio", "backoffice"] },
    ],
  },
  {
    area: "Prospect & Trattative",
    icon: ClipboardList,
    pagine: [
      { nome: "Lista Prospect", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
      { nome: "Dettaglio Prospect", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
      { nome: "Trattative", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
    ],
  },
  {
    area: "Portafoglio",
    icon: FileText,
    pagine: [
      { nome: "Lista Portafoglio", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
      { nome: "Dettaglio Portafoglio", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
      { nome: "Gestione Polizze", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Immissione Polizza", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Rinnovi", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Storno Polizza", ruoli: ["admin", "ufficio"] },
      { nome: "Sospensione Polizza", ruoli: ["admin", "ufficio"] },
      { nome: "Riattivazione Polizza", ruoli: ["admin", "ufficio"] },
      { nome: "Appendici Polizza", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Duplicazione Polizza", ruoli: ["admin", "ufficio"] },
      { nome: "Conferma Emittende", ruoli: ["admin", "ufficio"] },
      { nome: "Titoli", ruoli: ["admin", "ufficio", "contabilita"] },
    ],
  },
  {
    area: "Sinistri",
    icon: AlertTriangle,
    pagine: [
      { nome: "Lista Sinistri", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Dettaglio Sinistro", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Analisi Preventivo RCA", ruoli: ["admin", "ufficio"] },
      { nome: "Doc Precontrattuale", ruoli: ["admin", "ufficio"] },
    ],
  },
  {
    area: "Contabilità Ufficio",
    icon: Calculator,
    pagine: [
      { nome: "Contabilità Ufficio", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Cruscotto Giornaliero", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Distinta Giornaliera", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Quadratura Premi", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Chiusura Contabile", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "E/C Clienti", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "E/C Compagnia", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "E/C Produttori", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Import Provvigioni", ruoli: ["admin", "ufficio"] },
      { nome: "Diff. Provvigioni", ruoli: ["admin", "ufficio"] },
      { nome: "Report IVA", ruoli: ["admin", "ufficio", "contabilita"] },
    ],
  },
  {
    area: "Contabilità Generale",
    icon: Landmark,
    pagine: [
      { nome: "Piano dei Conti", ruoli: ["admin", "cfo"] },
      { nome: "Primanota Generale", ruoli: ["admin", "cfo"] },
      { nome: "Scadenziario", ruoli: ["admin", "cfo"] },
      { nome: "Clienti Contabilità", ruoli: ["admin", "cfo"] },
      { nome: "Elaborazioni Periodiche", ruoli: ["admin", "cfo"] },
      { nome: "Elaborazioni Annuali", ruoli: ["admin", "cfo"] },
      { nome: "Dichiarativi CU", ruoli: ["admin", "cfo"] },
      { nome: "Fornitori", ruoli: ["admin", "cfo"] },
      { nome: "Import Bancario", ruoli: ["admin", "cfo"] },
    ],
  },
  {
    area: "Estrazioni & Stampe",
    icon: Package,
    pagine: [
      { nome: "Estrazioni e Stampe", ruoli: ["admin", "ufficio"] },
      { nome: "Portafoglio per Cliente", ruoli: ["admin", "ufficio"] },
      { nome: "Portafoglio per Compagnia", ruoli: ["admin", "ufficio"] },
      { nome: "Premi e Provvigioni", ruoli: ["admin", "ufficio"] },
      { nome: "Premi Scoperti/Garantiti", ruoli: ["admin", "ufficio"] },
      { nome: "E/C Clienti (Estrazioni)", ruoli: ["admin", "ufficio"] },
    ],
  },
  {
    area: "Sistema",
    icon: Settings,
    pagine: [
      { nome: "Impostazioni", ruoli: ["admin", "ufficio"] },
      { nome: "Crea Utente", ruoli: ["admin"] },
      { nome: "Gestione Utenti", ruoli: ["admin"] },
      { nome: "Anomalie Sistema", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Backup & Export", ruoli: ["admin"] },
      { nome: "Manutenzione", ruoli: ["admin"] },
      { nome: "Tabelle di Base", ruoli: ["admin"] },
      { nome: "Compagnie", ruoli: ["admin"] },
      { nome: "Gestione Sedi", ruoli: ["admin"] },
      { nome: "Template Email", ruoli: ["admin", "ufficio"] },
      { nome: "Sitemap", ruoli: ["admin"] },
    ],
  },
  {
    area: "Altre Funzioni",
    icon: Send,
    pagine: [
      { nome: "Area CFO", ruoli: ["admin", "cfo"] },
      { nome: "Provvigioni Sede", ruoli: ["admin", "ufficio"] },
      { nome: "Pagamenti Provvigioni", ruoli: ["admin", "ufficio"] },
      { nome: "Rimessa Premi", ruoli: ["admin", "ufficio"] },
      { nome: "Notifiche", ruoli: ["admin", "ufficio", "contabilita", "produttore", "backoffice"] },
      { nome: "Comunicazioni", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Spedizioni", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Note Restituzione", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Flussi Compagnie", ruoli: ["admin", "ufficio"] },
      { nome: "Privacy & Consensi", ruoli: ["admin", "ufficio"] },
      { nome: "Report", ruoli: ["admin", "ufficio", "cfo"] },
      { nome: "Documentale", ruoli: ["admin", "ufficio"] },
      { nome: "Chat Interna", ruoli: ["admin", "ufficio", "contabilita", "produttore", "backoffice"] },
    ],
  },
  {
    area: "Portale Cliente",
    icon: UserCircle,
    pagine: [
      { nome: "Dashboard Cliente", ruoli: ["cliente"] },
      { nome: "Le mie Polizze", ruoli: ["cliente"] },
      { nome: "Dettaglio Polizza", ruoli: ["cliente"] },
      { nome: "Documenti", ruoli: ["cliente"] },
      { nome: "Scadenze", ruoli: ["cliente"] },
      { nome: "Pagamenti", ruoli: ["cliente"] },
      { nome: "Sinistri", ruoli: ["cliente"] },
      { nome: "Upload Documenti", ruoli: ["cliente"] },
      { nome: "Comunicazioni", ruoli: ["cliente"] },
      { nome: "Notifiche", ruoli: ["cliente"] },
    ],
  },
];

/* ─── PERMESSI JSON ─── */
const permessiJson = [
  { chiave: "dashboard", descrizione: "Accesso alla dashboard principale e KPI", sezioni: "Dashboard, Notifiche" },
  { chiave: "titoli", descrizione: "Gestione titoli e portafoglio polizze", sezioni: "Portafoglio, Titoli, Gestione Polizze" },
  { chiave: "sinistri", descrizione: "Accesso alla gestione sinistri", sezioni: "Sinistri (lista e dettaglio)" },
  { chiave: "contabilita", descrizione: "Operazioni contabili dell'ufficio", sezioni: "Contabilità Ufficio, Distinta, Quadratura, Chiusura, E/C" },
  { chiave: "cfo_area", descrizione: "Area finanziaria e contabilità generale", sezioni: "Area CFO, Cont. Generale, Import Bancario" },
  { chiave: "impostazioni", descrizione: "Configurazione sistema e gestione utenti", sezioni: "Sistema (tutte le sotto-pagine)" },
  { chiave: "provvigioni", descrizione: "Gestione provvigioni sede e pagamenti", sezioni: "Provvigioni Sede, Pagamenti Provvigioni" },
  { chiave: "rimessa_premi", descrizione: "Gestione rimessa premi alle compagnie", sezioni: "Rimessa Premi (lista e dettaglio)" },
];

const roleBadgeColor: Record<string, string> = {
  admin: "bg-red-500 text-white hover:bg-red-600",
  cfo: "bg-amber-500 text-white hover:bg-amber-600",
  ufficio: "bg-blue-500 text-white hover:bg-blue-600",
  contabilita: "bg-green-500 text-white hover:bg-green-600",
  produttore: "bg-purple-500 text-white hover:bg-purple-600",
  backoffice: "bg-teal-500 text-white hover:bg-teal-600",
  cliente: "bg-gray-500 text-white hover:bg-gray-600",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadgeColor[role] || "bg-muted text-muted-foreground"}`}>
      {role}
    </span>
  );
}

function SezioneCard({ sezione }: { sezione: typeof sezioni[0] }) {
  const [open, setOpen] = useState(false);
  const Icon = sezione.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="flex flex-row items-center gap-3 py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <Icon className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold flex-1">{sezione.area}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{sezione.pagine.length} pagine</Badge>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4">
            <div className="space-y-2">
              {sezione.pagine.map((p) => (
                <div key={p.nome} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm text-foreground">{p.nome}</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {p.ruoli.map((r) => <RoleBadge key={r} role={r} />)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function SitemapPage() {
  return (
    <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" />
          Sitemap — Organigramma Ruoli & Privilegi
        </h1>
        <p className="text-muted-foreground mt-1">
          Mappa completa del sistema CBnet: gerarchia ruoli, aree funzionali e permessi per ciascun livello.
        </p>
      </div>

      {/* ─── SEZIONE 1: GERARCHIA RUOLI ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Gerarchia Ruoli</h2>

        {/* Livello 1 */}
        <div className="flex justify-center mb-4">
          <RuoloCard ruolo={ruoli[0]} />
        </div>

        {/* Livello 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 max-w-4xl mx-auto">
          {ruoli.filter((r) => r.livello === 2).map((r) => <RuoloCard key={r.nome} ruolo={r} />)}
        </div>

        {/* Livello 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {ruoli.filter((r) => r.livello === 3).map((r) => <RuoloCard key={r.nome} ruolo={r} />)}
        </div>

        {/* Livello 4 */}
        <div className="flex justify-center">
          <RuoloCard ruolo={ruoli[ruoli.length - 1]} />
        </div>
      </section>

      {/* ─── SEZIONE 2: MAPPA SEZIONI ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Mappa delle Sezioni</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sezioni.map((s) => <SezioneCard key={s.area} sezione={s} />)}
        </div>
      </section>

      {/* ─── SEZIONE 3: PERMESSI JSON ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Permessi JSON (permessi_json)
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Chiave</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Descrizione</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Sezioni Controllate</th>
                  </tr>
                </thead>
                <tbody>
                  {permessiJson.map((p) => (
                    <tr key={p.chiave} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono text-primary">{p.chiave}</code>
                      </td>
                      <td className="py-2.5 px-4 text-foreground">{p.descrizione}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{p.sezioni}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RuoloCard({ ruolo }: { ruolo: typeof ruoli[0] }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ruolo.icon;

  return (
    <Card className={`border-l-4 ${ruolo.color} w-full`}>
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${ruolo.badgeColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">{ruolo.nome}</CardTitle>
              <Badge variant="outline" className="text-[10px]">Livello {ruolo.livello}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ruolo.descrizione}</p>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <ul className="space-y-1">
            {ruolo.mansioni.map((m, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                {m}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
