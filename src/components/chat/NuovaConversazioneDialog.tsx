import { useState } from "react";
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
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
  { value: "cliente", label: "Cliente" },
  { value: "trattativa", label: "Trattativa" },
  { value: "titolo", label: "Polizza" },
  { value: "sinistro", label: "Sinistro" },
  { value: "argomento", label: "Argomento libero" },
];

export default function NuovaConversazioneDialog({ open, onClose, onCreated, ambito = "interno" }: NuovaConversazioneDialogProps) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [filtroRuolo, setFiltroRuolo] = useState<string>("tutti");
  const [filtroUfficio, setFiltroUfficio] = useState<string>("tutti");
  const [ricerca, setRicerca] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [nomeGruppo, setNomeGruppo] = useState("");
  const [tipo, setTipo] = useState<"diretto" | "gruppo" | "broadcast">("diretto");

  // Contextual fields
  const [entitaTipo, setEntitaTipo] = useState<string>("argomento");
  const [entitaId, setEntitaId] = useState<string>("");
  const [visibileCliente, setVisibileCliente] = useState(false);

  const { data: utenti } = useQuery({
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

  const { data: uffici } = useQuery({
    queryKey: ["uffici_lista"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
    enabled: open,
  });

  // Search entities for contextual chat
  const [entitaRicerca, setEntitaRicerca] = useState("");
  const { data: entitaResults } = useQuery({
    queryKey: ["entita_search", entitaTipo, entitaRicerca],
    queryFn: async () => {
      if (entitaTipo === "argomento" || !entitaRicerca || entitaRicerca.length < 2) return [];
      if (entitaTipo === "cliente") {
        const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale").or(`cognome.ilike.%${entitaRicerca}%,ragione_sociale.ilike.%${entitaRicerca}%,nome.ilike.%${entitaRicerca}%`).limit(10);
        return (data || []).map((c: any) => ({ id: c.id, label: c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim() }));
      }
      if (entitaTipo === "trattativa") {
        const { data } = await supabase.from("trattative").select("id, titolo").ilike("titolo", `%${entitaRicerca}%`).limit(10);
        return (data || []).map((t: any) => ({ id: t.id, label: t.titolo || t.id }));
      }
      if (entitaTipo === "titolo") {
        const { data } = await supabase.from("titoli").select("id, numero_titolo").ilike("numero_titolo", `%${entitaRicerca}%`).limit(10);
        return (data || []).map((t: any) => ({ id: t.id, label: t.numero_titolo || t.id }));
      }
      if (entitaTipo === "sinistro") {
        const { data } = await supabase.from("sinistri").select("id, numero_sinistro").ilike("numero_sinistro", `%${entitaRicerca}%`).limit(10);
        return (data || []).map((s: any) => ({ id: s.id, label: s.numero_sinistro || s.id }));
      }
      return [];
    },
    enabled: open && ambito === "contestuale" && entitaTipo !== "argomento" && entitaRicerca.length >= 2,
  });

  const utentiFiltrati = (utenti || []).filter((u: any) => {
    if (filtroRuolo !== "tutti" && u.ruolo !== filtroRuolo) return false;
    if (filtroUfficio !== "tutti" && u.ufficio_id !== filtroUfficio) return false;
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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || selectedUsers.length === 0) return;

      if (ambito === "contestuale") {
        const nome = nomeGruppo || null;
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

        const allMembers = [profile.id, ...selectedUsers];
        await supabase.from("chat_canali_membri").insert(
          allMembers.map((uid) => ({
            canale_id: canale.id,
            user_id: uid,
            ruolo_canale: uid === profile.id ? "admin" : "membro",
          }))
        );
        return canale.id;
      }

      // Internal chat (same as before)
      const effectiveTipo = selectedUsers.length === 1 && tipo === "diretto" ? "diretto" : tipo === "diretto" ? "gruppo" : tipo;
      const nome = effectiveTipo === "diretto" ? null : nomeGruppo || null;

      const { data: canale } = await supabase
        .from("chat_canali")
        .insert({ nome, tipo: effectiveTipo, creato_da: profile.id, ambito: "interno" })
        .select()
        .single();

      if (!canale) throw new Error("Errore creazione canale");

      const allMembers = [profile.id, ...selectedUsers];
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
    setEntitaRicerca("");
    setVisibileCliente(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-lg">
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
              <Select value={entitaTipo} onValueChange={(v) => { setEntitaTipo(v); setEntitaId(""); setEntitaRicerca(""); }}>
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
                    onChange={(e) => setEntitaRicerca(e.target.value)}
                    placeholder={`Cerca ${ENTITA_TIPI.find(e => e.value === entitaTipo)?.label}...`}
                    className="h-8 text-xs"
                  />
                  {entitaResults && entitaResults.length > 0 && !entitaId && (
                    <div className="border rounded-md max-h-32 overflow-auto">
                      {entitaResults.map((r: any) => (
                        <button
                          key={r.id}
                          onClick={() => { setEntitaId(r.id); setEntitaRicerca(r.label); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {entitaId && (
                    <Badge variant="secondary" className="text-[10px]">
                      Collegato: {entitaRicerca}
                    </Badge>
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
              placeholder="Nome del gruppo (opzionale)"
            />
          )}

          {/* Filters */}
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

          <Input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca utente per nome..."
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
              {utentiFiltrati.map((u: any) => (
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
                    <span className="text-xs text-muted-foreground ml-2 capitalize">{u.ruolo}</span>
                  </div>
                </label>
              ))}
              {!utentiFiltrati.length && (
                <p className="text-center text-xs text-muted-foreground py-4">Nessun utente trovato</p>
              )}
            </div>
          </ScrollArea>

          {selectedUsers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedUsers.length} utente/i selezionato/i
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
