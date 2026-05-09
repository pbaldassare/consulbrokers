import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, User as UserIcon, FileText, Settings2 } from "lucide-react";
import { PolizzaHeaderCard } from "@/components/polizze/PolizzaHeaderCard";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";

const StornoPolizzaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paramPolizza = searchParams.get("polizza") || "";
  const paramRiga = searchParams.get("riga") || "";
  const paramClienteId = searchParams.get("clienteId") || "";
  const paramTitoloId = searchParams.get("titoloId") || "";
  const fromDettaglio = !!(paramPolizza && paramClienteId);

  const [codiceCliente, setCodiceCliente] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [numeroPolizza, setNumeroPolizza] = useState(paramPolizza);
  const [riga, setRiga] = useState(paramRiga);
  const [appendice, setAppendice] = useState("");

  const { data: clienteFromId } = useQuery({
    queryKey: ["cliente-by-id-storno", paramClienteId],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, codice_fiscale").eq("id", paramClienteId).maybeSingle();
      return data;
    },
    enabled: !!paramClienteId,
  });

  const { data: clienteFromSearch } = useQuery({
    queryKey: ["cliente-lookup-storno", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, codice_fiscale").or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%`).limit(1).maybeSingle();
      return data;
    },
    enabled: !fromDettaglio && codiceCliente.length >= 2,
  });

  const clienteData = fromDettaglio ? clienteFromId : clienteFromSearch;

  useEffect(() => {
    if (clienteFromId?.codice_fiscale && fromDettaglio) setCodiceCliente(clienteFromId.codice_fiscale);
  }, [clienteFromId, fromDettaglio]);

  const { data: aeList } = useQuery({
    queryKey: ["ae-list-storno"],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali").select("id, codice, cognome, nome, sigla").eq("tipo", "account_executive").eq("attivo", true).order("cognome");
      return data || [];
    },
  });

  const handleConferma = () => {
    // TODO: implementare logica storno polizza
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <PolizzaHeaderCard
        titoloId={paramTitoloId || undefined}
        pageTitle="Storno Polizza"
        pageSubtitle={paramTitoloId ? undefined : "Storno polizze dal portafoglio"}
        backTo={paramTitoloId ? `/titoli/${paramTitoloId}` : "/portafoglio/attive"}
      />

      <PolizzaSection title="Cliente" icon={UserIcon}>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5 flex-1 max-w-[220px]">
            <Label htmlFor="codice-cliente-st">Codice</Label>
            <div className="relative">
              <Input id="codice-cliente-st" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Codice cliente" readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          {clienteData && (
            <p className="text-sm text-foreground pb-2">
              {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5 max-w-[320px] mt-3">
          <Label>A/E</Label>
          <select value={selectedAE} onChange={(e) => setSelectedAE(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">— Seleziona —</option>
            {aeList?.map((ae) => (
              <option key={ae.id} value={ae.id}>{ae.sigla || ae.codice} - {ae.cognome} {ae.nome}</option>
            ))}
          </select>
        </div>
      </PolizzaSection>

      <PolizzaSection title="Polizza" icon={FileText}>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[260px]">
            <Label htmlFor="numero-polizza-st">Numero</Label>
            <div className="relative">
              <Input id="numero-polizza-st" value={numeroPolizza} onChange={(e) => setNumeroPolizza(e.target.value)} placeholder="N° polizza" readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="riga-st">Riga</Label>
            <Input id="riga-st" value={riga} onChange={(e) => setRiga(e.target.value)} readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
          </div>
          <div className="space-y-1.5 w-[120px]">
            <Label htmlFor="appendice-st">Appendice</Label>
            <Input id="appendice-st" value={appendice} onChange={(e) => setAppendice(e.target.value)} />
          </div>
        </div>
      </PolizzaSection>

      <PolizzaSection title="Tipo Operazione" icon={Settings2}>
        <RadioGroup value="storno" className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="storno" id="tipo-storno" />
            <Label htmlFor="tipo-storno" className="font-normal cursor-pointer">Storno</Label>
          </div>
        </RadioGroup>
      </PolizzaSection>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => fromDettaglio && paramTitoloId ? navigate(`/titoli/${paramTitoloId}`) : navigate("/portafoglio/attive")}>Chiudi</Button>
        <Button onClick={handleConferma}>Conferma</Button>
      </div>
    </div>
  );
};

export default StornoPolizzaPage;
