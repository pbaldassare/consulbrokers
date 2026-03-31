import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, MapPin, Phone, Mail, Clock, User } from "lucide-react";

const ClienteUfficio = () => {
  const { user } = useAuth();
  const [ufficio, setUfficio] = useState<any>(null);
  const [specialist, setSpecialist] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get cliente -> ufficio
      const { data: cliente } = await supabase
        .from("clienti")
        .select("id, ufficio_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cliente?.ufficio_id) {
        const { data: uf } = await supabase
          .from("uffici")
          .select("*")
          .eq("id", cliente.ufficio_id)
          .maybeSingle();
        setUfficio(uf);
      }

      if (cliente?.id) {
        // Get specialist from codici_commerciali_cliente
        const { data: cc } = await supabase
          .from("codici_commerciali_cliente")
          .select("profilo_id, ruolo, filiale")
          .eq("cliente_id", cliente.id)
          .limit(1)
          .maybeSingle();

        if (cc?.profilo_id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("nome, cognome, email, telefono")
            .eq("id", cc.profilo_id)
            .maybeSingle();
          if (prof) {
            setSpecialist({ nome: prof.nome, cognome: prof.cognome, email: prof.email, telefono: prof.telefono, ruolo: cc.ruolo, filiale: cc.filiale });
          }
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Caricamento...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Il Mio Ufficio</h2>

      {ufficio ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {ufficio.nome_ufficio}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ufficio.indirizzo && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Indirizzo</p>
                  <p className="text-sm font-medium">{ufficio.indirizzo}</p>
                </div>
              </div>
            )}
            {ufficio.telefono && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefono</p>
                  <p className="text-sm font-medium">{ufficio.telefono}</p>
                </div>
              </div>
            )}
            {ufficio.email && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email / PEC</p>
                  <p className="text-sm font-medium">{ufficio.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Orari</p>
                <p className="text-sm font-medium">Lun — Gio: 8:30–13:30 / 14:30–18:00</p>
                <p className="text-sm font-medium">Venerdì: 8:30–14:30</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground">Nessun ufficio assegnato.</p>
      )}

      {specialist && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Il Tuo Referente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{specialist.ruolo || "Specialist"}</p>
                <p className="text-sm font-medium">{specialist.nome} {specialist.cognome}</p>
              </div>
            </div>
            {specialist.email && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{specialist.email}</p>
                </div>
              </div>
            )}
            {(specialist.telefono || specialist.cellulare) && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefono</p>
                  <p className="text-sm font-medium">{specialist.telefono || specialist.cellulare}</p>
                </div>
              </div>
            )}
            {specialist.filiale && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Filiale</p>
                  <p className="text-sm font-medium">{specialist.filiale}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClienteUfficio;
