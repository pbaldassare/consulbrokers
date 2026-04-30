import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Pencil, UserCog } from "lucide-react";

interface SpecialistRow {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  ufficio_id: string | null;
  attivo: boolean | null;
}

const SpecialistList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["specialist-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cognome, email, ruolo, ufficio_id, attivo")
        .eq("ruolo", "backoffice")
        .order("cognome", { ascending: true });
      if (error) throw error;
      return (data || []) as SpecialistRow[];
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_select_short"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici" as any)
        .select("id, codice_ufficio, nome_ufficio");
      return (data || []) as unknown as { id: string; codice_ufficio: string; nome_ufficio: string }[];
    },
  });

  const ufficioMap = Object.fromEntries(uffici.map(u => [u.id, `${u.codice_ufficio} — ${u.nome_ufficio}`]));

  const filtered = items.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.nome?.toLowerCase().includes(s)) ||
      (p.cognome?.toLowerCase().includes(s)) ||
      (p.email?.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, cognome, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filtered.length} risultati</Badge>
      </div>

      <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground flex items-start gap-2">
        <UserCog className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          Gli <strong>Specialist</strong> sono utenti di sistema con ruolo <code className="text-foreground">backoffice</code>.
          Per modificare permessi, sede o credenziali apri il pannello completo dell'utente in <em>Centro Utenti & Privilegi</em>.
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cognome</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead className="text-center">Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessuno Specialist trovato</TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{p.cognome || "—"}</TableCell>
                  <TableCell>{p.nome || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.email || "—"}</TableCell>
                  <TableCell className="text-sm">{p.ufficio_id ? (ufficioMap[p.ufficio_id] || "—") : "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={p.attivo ? "default" : "secondary"} className="text-xs">
                      {p.attivo ? "Attivo" : "Disattivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/utenti-privilegi?user=${p.id}`)}
                      title="Apri scheda utente"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SpecialistList;
