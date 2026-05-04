import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";

const ConfermaEmittendePage = () => {
  const navigate = useNavigate();

  const [codiceCliente, setCodiceCliente] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [numeroPolizza, setNumeroPolizza] = useState("");
  const [riga, setRiga] = useState("");
  const [appendice, setAppendice] = useState("");
  const [tipoOperazione, setTipoOperazione] = useState("polizza");
  const [polizzaAuto, setPolizzaAuto] = useState(false);

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup-conf", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale")
        .or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: codiceCliente.length >= 2,
  });

  const { data: aeList } = useQuery({
    queryKey: ["ae-list-conf"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla")
        .eq("tipo", "account_executive")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const handleConferma = () => {
    // TODO: implementare logica conferma emittende
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conferma Emittende</h1>
        <p className="text-sm text-muted-foreground mt-1">Conferma emissione polizze emittende</p>
      </div>

      {/* CLIENTE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Cliente</legend>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="codice-cliente-conf">Codice</Label>
            <div className="relative">
              <Input id="codice-cliente-conf" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Codice cliente" />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          {clienteData && (
            <p className="text-sm text-foreground pb-2">
              {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5 max-w-[300px]">
          <Label>A/E</Label>
          <select value={selectedAE} onChange={(e) => setSelectedAE(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">— Seleziona —</option>
            {aeList?.map((ae) => (
              <option key={ae.id} value={ae.id}>{ae.sigla || ae.codice} - {ae.cognome} {ae.nome}</option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* POLIZZA */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Polizza</legend>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[250px]">
            <Label htmlFor="numero-polizza-conf">Numero</Label>
            <div className="relative">
              <Input id="numero-polizza-conf" value={numeroPolizza} onChange={(e) => setNumeroPolizza(e.target.value)} placeholder="N° polizza" />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="riga-conf">Riga</Label>
            <Input id="riga-conf" value={riga} onChange={(e) => setRiga(e.target.value)} />
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="appendice-conf">Appendice</Label>
            <Input id="appendice-conf" value={appendice} onChange={(e) => setAppendice(e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* TIPO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Tipo</legend>
        <div className="space-y-3">
          <Label>Tipo Operazione</Label>
          <RadioGroup value={tipoOperazione} onValueChange={setTipoOperazione} className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="polizza" id="tipo-polizza-conf" />
              <Label htmlFor="tipo-polizza-conf" className="font-normal cursor-pointer">Polizza</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="emittenda" id="tipo-emittenda-conf" />
              <Label htmlFor="tipo-emittenda-conf" className="font-normal cursor-pointer">Emittenda</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cp_nuova" id="tipo-cp-nuova-conf" />
              <Label htmlFor="tipo-cp-nuova-conf" className="font-normal cursor-pointer">CP (Nuova)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cp_sost_rinn" id="tipo-cp-sost-conf" />
              <Label htmlFor="tipo-cp-sost-conf" className="font-normal cursor-pointer">CP (Sost/Rinn)</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox id="polizza-auto-conf" checked={polizzaAuto} onCheckedChange={(v) => setPolizzaAuto(v === true)} />
          <Label htmlFor="polizza-auto-conf" className="font-normal cursor-pointer">Polizza Auto</Label>
        </div>
      </fieldset>

      {/* ACTIONS */}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate("/portafoglio/attive")}>Chiudi</Button>
        <Button onClick={handleConferma}>Conferma</Button>
      </div>
    </div>
  );
};

export default ConfermaEmittendePage;
