import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, CheckCircle2 } from "lucide-react";

const CreaNuovoUtente = () => {
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cognome: "",
    email: "",
    template_id: "",
    ufficio_id: "",
  });

  const { data: templates } = useQuery({
    queryKey: ["ruoli_template"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ruoli_template").select("*").order("nome_template");
      if (error) throw error;
      return data;
    },
  });

  const { data: uffici } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data;
    },
  });

  const selectedTemplate = templates?.find((t) => t.id === form.template_id);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome || !form.cognome || !form.email || !selectedTemplate) {
        throw new Error("Compila tutti i campi obbligatori");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione non valida. Effettua il login.");

      const response = await supabase.functions.invoke("create-user", {
        body: {
          nome: form.nome,
          cognome: form.cognome,
          email: form.email,
          ruolo: selectedTemplate.ruolo_base,
          ufficio_id: form.ufficio_id || null,
          permessi_json: selectedTemplate.permessi_json,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Errore nella creazione utente");
      }

      const result = response.data;
      if (!result.success) {
        throw new Error(result.error || "Errore nella creazione utente");
      }

      return result;
    },
    onSuccess: () => {
      setSuccess(true);
      setForm({ nome: "", cognome: "", email: "", template_id: "", ufficio_id: "" });
    },
    onError: (err: Error) => {
      toast.error("Errore");
    },
  });

  const showUfficio = selectedTemplate && ["ufficio", "produttore"].includes(selectedTemplate.ruolo_base || "");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span>
        <span>›</span>
        <span>Impostazioni</span>
        <span>›</span>
        <span>Crea Nuovo Utente</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crea Nuovo Utente</h1>
          <p className="text-sm text-muted-foreground">Crea un nuovo utente selezionando un template preconfigurato</p>
        </div>
      </div>

      {success ? (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-accent mx-auto" />
          <h3 className="text-xl font-semibold text-foreground">Utente creato con successo</h3>
          <p className="text-muted-foreground">Password temporanea generata. L'utente dovrà cambiarla al primo accesso.</p>
          <Button onClick={() => setSuccess(false)} className="mt-4">
            Crea un altro utente
          </Button>
        </Card>
      ) : (
        <Card className="p-6 max-w-xl">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Mario"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cognome *</Label>
                <Input
                  value={form.cognome}
                  onChange={(e) => setForm({ ...form, cognome: e.target.value })}
                  placeholder="Rossi"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="mario.rossi@esempio.it"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Template Ruolo *</Label>
              <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome_template} ({t.ruolo_base})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate?.descrizione && (
                <p className="text-xs text-muted-foreground mt-1">{selectedTemplate.descrizione}</p>
              )}
            </div>

            {showUfficio && (
              <div className="space-y-1.5">
                <Label>Ufficio</Label>
                <Select value={form.ufficio_id} onValueChange={(v) => setForm({ ...form, ufficio_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ufficio" />
                  </SelectTrigger>
                  <SelectContent>
                    {uffici?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome_ufficio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.nome || !form.cognome || !form.email || !form.template_id}
                className="w-full gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {createMutation.isPending ? "Creazione in corso..." : "Crea Utente"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CreaNuovoUtente;
