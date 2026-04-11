import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { UserCheck, Briefcase, FileText, AlertTriangle, Users, Loader2 } from "lucide-react";
import { findAllRelatedUsers, type RelatedUser } from "@/lib/findRelatedUsers";

interface NuovaConversazioneDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (canaleId: string) => void;
  ambito?: "interno" | "contestuale";
}

const RUOLI_INTERNI = [
  { value: "admin", label: "Admin" },
  { value: "ufficio", label: "Ufficio" },
  { value: "produttore", label: "Produttore" },
  { value: "backoffice", label: "Specialist" },
  { value: "contabilita", label: "Contabilità" },
  { value: "cfo", label: "CFO" },
];

const ENTITA_TIPI = [
  { value: "cliente", label: "Cliente", icon: UserCheck },
  { value: "trattativa", label: "Trattativa", icon: Briefcase },
  { value: "titolo", label: "Polizza", icon: FileText },
  { value: "sinistro", label: "Sinistro", icon: AlertTriangle },
  { value: "argomento", label: "Argomento libero", icon: Users },
];

interface EntitaResult {
  id: string;
  label: string;
  subtitle?: string;
  clienteUserId?: string | null;
}

export default function NuovaConversazioneDialog({ open, onClose, onCreated, ambito = "interno" }: NuovaConversazioneDialogProps) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [filtroRuolo, setFiltroRuolo] = useState<string>("tutti");
  const [filtroUfficio, setFiltroUfficio] = useState<string>("tutti");
  const [ricerca, setRicerca] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [nomeGruppo, setNomeGruppo] = useState("");
  const [tipo, setTipo] = useState<"diretto" | "gruppo" | "broadcast">("diretto");
  const [sezioneUtenti, setSezioneUtenti] = useState<"staff" | "clienti">("staff");

  const [entitaTipo, setEntitaTipo] = useState<string>("argomento");
  const [entitaId, setEntitaId] = useState<string>("");
  const [entitaLabel, setEntitaLabel] = useState<string>("");
  const [visibileCliente, setVisibileCliente] = useState(false);
  const [autoLinkedClientUserId, setAutoLinkedClientUserId] = useState<string | null>(null);
  const [autoLinkedUsers, setAutoLinkedUsers] = useState<RelatedUser[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Load internal staff
  const { data: utentiStaff } = useQuery({
    queryKey: ["profiles_interni"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo, ufficio_id, email")
        .eq("attivo", true)
        .in("ruolo", ["admin", "ufficio", "produttore", "backoffice", "contabilita", "cfo"])
        .order("cognome");
      return (data || []).filter((u: any) => u.id !== profile?.id);
    },
    enabled: open,
  });

  // Load client users (only when contextual + visibileCliente)
  const { data: utentiClienti } = useQuery({
    queryKey: ["profiles_clienti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo, email")
        .eq("attivo", true)
        .eq("ruolo", "cliente")
        .order("cognome");
      return data || [];
    },
    enabled: open && ambito === "contestuale",
  });

  const { data: uffici } = useQuery({
    queryKey: ["uffici_lista"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
    enabled: open,
  });

  // Rich entity search with joins
  const [entitaRicerca, setEntitaRicerca] = useState("");
  const { data: entitaResults } = useQuery({
    queryKey: ["entita_search_rich", entitaTipo, entitaRicerca],
    queryFn: async (): Promise<EntitaResult[]> => {
      if (entitaTipo === "argomento" || !entitaRicerca || entitaRicerca.length < 2) return [];

      if (entitaTipo === "cliente") {
        const { data } = await supabase
          .from("clienti")
          .select("id, nome, cognome, ragione_sociale, tipo_cliente, email, telefono, user_id")
          .or(`cognome.ilike.%${entitaRicerca}%,ragione_sociale.ilike.%${entitaRicerca}%,nome.ilike.%${entitaRicerca}%,codice_fiscale.ilike.%${entitaRicerca}%`)
          .limit(10);
        return (data || []).map((c: any) => ({
          id: c.id,
          label: c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim(),
          subtitle: `${c.tipo_cliente || "Privato"} ${c.email ? `• ${c.email}` : ""} ${c.telefono ? `• ${c.telefono}` : ""}`.trim(),
          clienteUserId: c.user_id || null,
        }));
      }

      if (entitaTipo === "titolo") {
        const { data } = await supabase
          .from("titoli")
          .select("id, numero_titolo, cliente_anagrafica_id, compagnia_id, ramo_id, clienti:cliente_anagrafica_id(nome, cognome, ragione_sociale, user_id), compagnie:compagnia_id(nome)")
          .or(`numero_titolo.ilike.%${entitaRicerca}%`)
          .limit(10);
        return (data || []).map((t: any) => {
          const clienteNome = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
          const compNome = t.compagnie?.nome || "";
          return {
            id: t.id,
            label: `${t.numero_titolo || t.id}`,
            subtitle: `${clienteNome}${compNome ? ` • ${compNome}` : ""}`,
            clienteUserId: t.clienti?.user_id || null,
          };
        });
      }

      if (entitaTipo === "trattativa") {
        const { data } = await supabase
          .from("trattative")
          .select("id, prodotto, stato, cliente_id, prospect_id, clienti:cliente_id(nome, cognome, ragione_sociale, user_id), prospect:prospect_id(nome, cognome, ragione_sociale)")
          .or(`prodotto.ilike.%${entitaRicerca}%,stato.ilike.%${entitaRicerca}%`)
          .limit(10);
        return (data || []).map((t: any) => {
          const clienteNome = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
          const prospectNome = t.prospect?.ragione_sociale || `${t.prospect?.cognome || ""} ${t.prospect?.nome || ""}`.trim();
          const soggetto = clienteNome || prospectNome || "—";
          return {
            id: t.id,
            label: t.prodotto || `Trattativa`,
            subtitle: `${soggetto} • ${t.stato || ""}`,
            clienteUserId: t.clienti?.user_id || null,
          };
        });
      }

      if (entitaTipo === "sinistro") {
        const { data } = await supabase
          .from("sinistri")
          .select("id, numero_sinistro, tipo_sinistro, stato, cliente_anagrafica_id, titolo_id, clienti:cliente_anagrafica_id(nome, cognome, ragione_sociale, user_id)")
          .or(`numero_sinistro.ilike.%${entitaRicerca}%`)
          .limit(10);
        return (data || []).map((s: any) => {
          const clienteNome = s.clienti?.ragione_sociale || `${s.clienti?.cognome || ""} ${s.clienti?.nome || ""}`.trim();
          return {
            id: s.id,
            label: s.numero_sinistro || s.id,
            subtitle: `${s.tipo_sinistro || ""} • ${clienteNome} • ${s.stato || ""}`,
            clienteUserId: s.clienti?.user_id || null,
          };
        });
      }

      return [];
    },
    enabled: open && ambito === "contestuale" && entitaTipo !== "argomento" && entitaRicerca.length >= 2,
  });

  // Auto-add all related users when entity is selected
  useEffect(() => {
    if (autoLinkedUsers.length > 0) {
      const relatedIds = autoLinkedUsers.map(u => u.userId).filter(id => id !== profile?.id);
      setSelectedUsers((prev) => {
        const set = new Set(prev);
        relatedIds.forEach(id => set.add(id));
        return Array.from(set);
      });
      // Auto-enable visibile_cliente if any client user is found
      if (autoLinkedUsers.some(u => u.ruolo === "cliente")) {
        setVisibileCliente(true);
      }
    }
  }, [autoLinkedUsers, profile?.id]);

  const currentUsersList = sezioneUtenti === "staff" ? (utentiStaff || []) : (utentiClienti || []);

  const utentiFiltrati = currentUsersList.filter((u: any) => {
    if (sezioneUtenti === "staff") {
      if (filtroRuolo !== "tutti" && u.ruolo !== filtroRuolo) return false;
      if (filtroUfficio !== "tutti" && u.ufficio_id !== filtroUfficio) return false;
    }
    if (ricerca) {
      const full = `${u.nome || ""} ${u.cognome || ""} ${u.email || ""}`.toLowerCase();
      if (!full.includes(ricerca.toLowerCase())) return false;
    }
    return true;
  });

  const toggleUser = (id: string) => {
    if (tipo === "diretto" && ambito === "interno") {
      setSelectedUsers([id]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const selectAllFiltered = () => {
    const ids = utentiFiltrati.map((u: any) => u.id);
    setSelectedUsers((prev) => {
      const set = new Set(prev);
      ids.forEach((id: string) => set.add(id));
      return Array.from(set);
    });
  };

  const generateAutoName = (): string | null => {
    if (nomeGruppo) return nomeGruppo;
    if (entitaTipo === "argomento") return null;
    if (entitaLabel) {
      const tipoLabel = ENTITA_TIPI.find(e => e.value === entitaTipo)?.label || "";
      return `${tipoLabel}: ${entitaLabel}`;
    }
    return null;
  };

  const handleSelectEntita = async (r: EntitaResult) => {
    setEntitaId(r.id);
    setEntitaLabel(r.label);
    setEntitaRicerca(r.label);
    setAutoLinkedClientUserId(r.clienteUserId || null);

    // Find ALL related users (client, producers, office staff, commercials)
    if (entitaTipo !== "argomento") {
      setLoadingRelated(true);
      try {
        const related = await findAllRelatedUsers(entitaTipo, r.id);
        setAutoLinkedUsers(related);
      } catch (e) {
        console.error("Error finding related users:", e);
      } finally {
        setLoadingRelated(false);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || selectedUsers.length === 0) return;

      if (ambito === "contestuale") {
        const nome = generateAutoName();
        const { data: canale } = await supabase
          .from("chat_canali")
          .insert({
            nome,
            tipo: "gruppo",
            creato_da: profile.id,
            ambito: "contestuale",
            entita_tipo: entitaTipo,
            entita_id: entitaTipo === "argomento" ? null : entitaId || null,
            visibile_cliente: visibileCliente,
          })
          .select()
          .single();

        if (!canale) throw new Error("Errore creazione canale");

        const allMembers = Array.from(new Set([profile.id, ...selectedUsers]));
        await supabase.from("chat_canali_membri").insert(
          allMembers.map((uid) => ({
            canale_id: canale.id,
            user_id: uid,
            ruolo_canale: uid === profile.id ? "admin" : "membro",
          }))
        );
        return canale.id;
      }

      const effectiveTipo = selectedUsers.length === 1 && tipo === "diretto" ? "diretto" : tipo === "diretto" ? "gruppo" : tipo;
      const nome = effectiveTipo === "diretto" ? null : nomeGruppo || null;

      const { data: canale } = await supabase
        .from("chat_canali")
        .insert({ nome, tipo: effectiveTipo, creato_da: profile.id, ambito: "interno" })
        .select()
        .single();

      if (!canale) throw new Error("Errore creazione canale");

      const allMembers = Array.from(new Set([profile.id, ...selectedUsers]));
      await supabase.from("chat_canali_membri").insert(
        allMembers.map((uid) => ({
          canale_id: canale.id,
          user_id: uid,
          ruolo_canale: uid === profile.id ? "admin" : "membro",
        }))
      );
      return canale.id;
    },
    onSuccess: (canaleId) => {
      if (canaleId) {
        qc.invalidateQueries({ queryKey: ["chat_canali"] });
        toast.success("Conversazione creata");
        onCreated(canaleId);
        resetForm();
      }
    },
    onError: () => toast.error("Errore nella creazione"),
  });

  const resetForm = () => {
    setSelectedUsers([]);
    setNomeGruppo("");
    setRicerca("");
    setFiltroRuolo("tutti");
    setFiltroUfficio("tutti");
    setTipo("diretto");
    setEntitaTipo("argomento");
    setEntitaId("");
    setEntitaLabel("");
    setEntitaRicerca("");
    setVisibileCliente(false);
    setAutoLinkedClientUserId(null);
    setAutoLinkedUsers([]);
    setLoadingRelated(false);
    setSezioneUtenti("staff");
  };

  const selectedStaffCount = selectedUsers.filter(id => (utentiStaff || []).some((u: any) => u.id === id)).length;
  const selectedClientiCount = selectedUsers.filter(id => (utentiClienti || []).some((u: any) => u.id === id)).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {ambito === "contestuale" ? "Nuova Chat Contestuale" : "Nuova Conversazione"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Contextual entity selection */}
          {ambito === "contestuale" && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <Label className="text-xs font-semibold">Collega a entità</Label>
              <Select value={entitaTipo} onValueChange={(v) => { setEntitaTipo(v); setEntitaId(""); setEntitaLabel(""); setEntitaRicerca(""); setAutoLinkedClientUserId(null); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITA_TIPI.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {entitaTipo !== "argomento" && (
                <div className="space-y-1">
                  <Input
                    value={entitaRicerca}
                    onChange={(e) => { setEntitaRicerca(e.target.value); setEntitaId(""); setEntitaLabel(""); setAutoLinkedClientUserId(null); }}
                    placeholder={`Cerca ${ENTITA_TIPI.find(e => e.value === entitaTipo)?.label}...`}
                    className="h-8 text-xs"
                  />
                  {entitaResults && entitaResults.length > 0 && !entitaId && (
                    <div className="border rounded-md max-h-40 overflow-auto bg-background">
                      {entitaResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleSelectEntita(r)}
                          className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
                        >
                          <p className="text-xs font-medium">{r.label}</p>
                          {r.subtitle && <p className="text-[10px] text-muted-foreground">{r.subtitle}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                  {entitaId && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        ✓ {entitaLabel}
                      </Badge>
                      {autoLinkedClientUserId && (
                        <Badge variant="outline" className="text-[10px] text-primary">
                          👤 Cliente auto-collegato
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="visibile_cliente"
                  checked={visibileCliente}
                  onCheckedChange={setVisibileCliente}
                />
                <Label htmlFor="visibile_cliente" className="text-xs">Visibile al cliente</Label>
              </div>
            </div>
          )}

          {/* Tipo (only for internal) */}
          {ambito === "interno" && (
            <div className="flex gap-2">
              {(["diretto", "gruppo", "broadcast"] as const).map((t) => (
                <Badge
                  key={t}
                  variant={tipo === t ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => { setTipo(t); setSelectedUsers([]); }}
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {(tipo !== "diretto" || ambito === "contestuale") && (
            <Input
              value={nomeGruppo}
              onChange={(e) => setNomeGruppo(e.target.value)}
              placeholder={ambito === "contestuale" && entitaLabel ? `Auto: ${ENTITA_TIPI.find(e => e.value === entitaTipo)?.label}: ${entitaLabel}` : "Nome del gruppo (opzionale)"}
            />
          )}

          {/* Staff/Clienti toggle for contextual */}
          {ambito === "contestuale" && (
            <div className="flex gap-1">
              <Badge
                variant={sezioneUtenti === "staff" ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSezioneUtenti("staff")}
              >
                Staff {selectedStaffCount > 0 && `(${selectedStaffCount})`}
              </Badge>
              <Badge
                variant={sezioneUtenti === "clienti" ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setSezioneUtenti("clienti")}
              >
                Clienti {selectedClientiCount > 0 && `(${selectedClientiCount})`}
              </Badge>
            </div>
          )}

          {/* Filters (only for staff section) */}
          {sezioneUtenti === "staff" && (
            <div className="flex gap-2">
              <Select value={filtroRuolo} onValueChange={setFiltroRuolo}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti i ruoli</SelectItem>
                  {RUOLI_INTERNI.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroUfficio} onValueChange={setFiltroUfficio}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Sede" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti gli uffici</SelectItem>
                  {(uffici || []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder={sezioneUtenti === "staff" ? "Cerca staff per nome..." : "Cerca cliente per nome..."}
            className="h-8 text-xs"
          />

          {(tipo !== "diretto" || ambito === "contestuale") && utentiFiltrati.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={selectAllFiltered}>
              Seleziona tutti ({utentiFiltrati.length})
            </Button>
          )}

          {/* User list */}
          <ScrollArea className="h-52 border rounded-lg">
            <div className="p-1">
              {utentiFiltrati.map((u: any) => {
                const isAutoLinked = u.id === autoLinkedClientUserId;
                return (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{u.cognome} {u.nome}</span>
                      {sezioneUtenti === "staff" && (
                        <span className="text-xs text-muted-foreground ml-2 capitalize">{u.ruolo}</span>
                      )}
                      {u.email && sezioneUtenti === "clienti" && (
                        <span className="text-[10px] text-muted-foreground ml-2">{u.email}</span>
                      )}
                    </div>
                    {isAutoLinked && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-primary">Auto</Badge>
                    )}
                    {sezioneUtenti === "clienti" && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Cliente</Badge>
                    )}
                  </label>
                );
              })}
              {!utentiFiltrati.length && (
                <p className="text-center text-xs text-muted-foreground py-4">Nessun utente trovato</p>
              )}
            </div>
          </ScrollArea>

          {selectedUsers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedUsers.length} partecipante/i selezionato/i
              {selectedStaffCount > 0 && selectedClientiCount > 0 && (
                <span> ({selectedStaffCount} staff, {selectedClientiCount} clienti)</span>
              )}
            </p>
          )}

          <Button
            onClick={() => createMutation.mutate()}
            disabled={selectedUsers.length === 0 || createMutation.isPending || (ambito === "contestuale" && entitaTipo !== "argomento" && !entitaId)}
            className="w-full"
          >
            Crea conversazione
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
