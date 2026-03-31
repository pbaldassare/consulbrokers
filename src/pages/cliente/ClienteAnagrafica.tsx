import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Mail, Phone, MapPin, FileText, Globe } from "lucide-react";

const ClienteAnagrafica = () => {
  const { user } = useAuth();
  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("clienti")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCliente(data);
        setLoading(false);
      });
  }, [user]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Caricamento...</div>;
  if (!cliente) return <div className="text-center py-12 text-muted-foreground">Nessun dato trovato.</div>;

  const fields = [
    { icon: Building2, label: "Ragione Sociale", value: cliente.ragione_sociale },
    { icon: FileText, label: "Tipo", value: cliente.tipo_cliente?.toUpperCase() },
    { icon: FileText, label: "P.IVA", value: cliente.partita_iva },
    { icon: FileText, label: "Codice Fiscale", value: cliente.codice_fiscale_azienda || cliente.codice_fiscale },
    { icon: FileText, label: "Codice SDI", value: cliente.codice_sdi },
    { icon: MapPin, label: "Sede", value: [cliente.indirizzo_sede, cliente.cap_sede, cliente.citta_sede, cliente.provincia_sede ? `(${cliente.provincia_sede})` : null].filter(Boolean).join(", ") },
    { icon: Mail, label: "Email", value: cliente.email },
    { icon: Mail, label: "PEC", value: cliente.pec },
    { icon: Phone, label: "Telefono", value: cliente.telefono },
    { icon: Globe, label: "Nazione", value: cliente.nazione },
    { icon: Building2, label: "Settore", value: cliente.settore },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">I Miei Dati</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Anagrafica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f, i) => f.value ? (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <f.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-medium text-foreground">{f.value}</p>
                </div>
              </div>
            ) : null)}
          </div>
          {cliente.note && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Note</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{cliente.note}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteAnagrafica;
