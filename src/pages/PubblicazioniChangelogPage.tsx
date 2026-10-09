import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Megaphone, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isRootAdminEmail } from "@/lib/adminAccountGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageContainer } from "@/components/shared/PageContainer";
import { ChangelogContenuto, type Changelog } from "@/components/ChangelogPopup";

const CAMPI = [
  ["cambiamenti", "Cambiamenti", "Un cambiamento per riga"],
  ["bug_in_carico", "Bug presi in carico", "Un bug per riga"],
  ["problemi_noti", "Problemi noti", "Un problema per riga"],
] as const;
type Campo = (typeof CAMPI)[number][0];
type Testi = Record<Campo, string>;

type Attivi = Record<Campo, boolean>;

const VUOTO: Testi = { cambiamenti: "", bug_in_carico: "", problemi_noti: "" };
const TUTTI_ATTIVI: Attivi = { cambiamenti: true, bug_in_carico: true, problemi_noti: true };
const righe = (t: string) => t.split("\n").map((r) => r.trim()).filter(Boolean);
/** Le categorie non spuntate non vanno né in bozza né in pubblicazione (il testo resta solo nell'editor). */
const daTesti = (t: Testi, a: Attivi) => ({
  cambiamenti: a.cambiamenti ? righe(t.cambiamenti) : [],
  bug_in_carico: a.bug_in_carico ? righe(t.bug_in_carico) : [],
  problemi_noti: a.problemi_noti ? righe(t.problemi_noti) : [],
});

/**
 * Editor del changelog (solo admin@consul.it): una bozza alla volta, poi "Pubblica" la manda
 * a tutti i colleghi del gestionale al loro prossimo accesso (vedi ChangelogPopup).
 */
export default function PubblicazioniChangelogPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [testi, setTesti] = useState<Testi>(VUOTO);
  const [attivi, setAttivi] = useState<Attivi>(TUTTI_ATTIVI);
  const [salvando, setSalvando] = useState(false);
  const [confermaPubblica, setConfermaPubblica] = useState(false);

  const { data: tutti = [], isLoading } = useQuery({
    queryKey: ["changelog-editor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("changelog" as never)
        .select("id, pubblicato_at, cambiamenti, bug_in_carico, problemi_noti, creato_at")
        .order("creato_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as (Changelog & { creato_at: string })[];
    },
  });
  const bozza = tutti.find((c) => !c.pubblicato_at) ?? null;
  const pubblicati = tutti.filter((c) => c.pubblicato_at);

  // Carica nell'editor la bozza esistente (una sola alla volta)
  useEffect(() => {
    setTesti(
      bozza
        ? {
            cambiamenti: bozza.cambiamenti.join("\n"),
            bug_in_carico: bozza.bug_in_carico.join("\n"),
            problemi_noti: bozza.problemi_noti.join("\n"),
          }
        : VUOTO,
    );
    // Bozza salvata: spuntate solo le categorie che contiene; nuova bozza: tutte
    setAttivi(
      bozza
        ? { cambiamenti: !!bozza.cambiamenti.length, bug_in_carico: !!bozza.bug_in_carico.length, problemi_noti: !!bozza.problemi_noti.length }
        : TUTTI_ATTIVI,
    );
  }, [bozza?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isRootAdminEmail(profile?.email)) {
    return <PageContainer><p className="text-sm text-muted-foreground">Sezione riservata ad admin@consul.it.</p></PageContainer>;
  }

  const contenuto = daTesti(testi, attivi);
  const vuoto = !contenuto.cambiamenti.length && !contenuto.bug_in_carico.length && !contenuto.problemi_noti.length;

  const salva = async (pubblica: boolean) => {
    setSalvando(true);
    const riga = { ...contenuto, ...(pubblica ? { pubblicato_at: new Date().toISOString() } : {}) };
    const { error } = bozza
      ? await supabase.from("changelog" as never).update(riga as never).eq("id", bozza.id)
      : await supabase.from("changelog" as never).insert(riga as never);
    setSalvando(false);
    if (error) return toast.error("Salvataggio non riuscito", { description: error.message });
    toast.success(pubblica ? "Changelog pubblicato: i colleghi lo vedranno al prossimo accesso" : "Bozza salvata");
    qc.invalidateQueries({ queryKey: ["changelog-editor"] });
    qc.invalidateQueries({ queryKey: ["changelog-da-mostrare"] });
  };

  return (
    <PageContainer variant="full">
      <div className="mb-6 flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Pubblicazioni Changelog</h1>
          <p className="text-sm text-muted-foreground">
            Scrivi la bozza, controlla l'anteprima e pubblica: ogni collega la vede una sola volta al prossimo accesso.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{bozza ? "Bozza in lavorazione" : "Nuova bozza"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {CAMPI.map(([campo, etichetta, aiuto]) => (
                <div key={campo} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`cl-${campo}-attivo`}
                      checked={attivi[campo]}
                      onCheckedChange={(v) => setAttivi((x) => ({ ...x, [campo]: v === true }))}
                    />
                    <Label htmlFor={`cl-${campo}-attivo`} className="cursor-pointer">{etichetta}</Label>
                    {!attivi[campo] && <span className="text-xs text-muted-foreground">non pubblicata</span>}
                  </div>
                  <Textarea
                    id={`cl-${campo}`}
                    aria-label={etichetta}
                    rows={campo === "cambiamenti" ? 8 : 4}
                    placeholder={aiuto}
                    value={testi[campo]}
                    disabled={!attivi[campo]}
                    className="disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                    onChange={(e) => setTesti((t) => ({ ...t, [campo]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={salvando || vuoto} onClick={() => salva(false)}>
                  <Save className="mr-1.5 h-4 w-4" /> Salva bozza
                </Button>
                <Button disabled={salvando || vuoto} onClick={() => setConfermaPubblica(true)}>
                  {salvando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                  Pubblica
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anteprima — Ultimi cambiamenti effettuati al portale</CardTitle>
            </CardHeader>
            <CardContent>
              {vuoto ? <p className="text-sm text-muted-foreground">Scrivi qualcosa a sinistra.</p> : <ChangelogContenuto changelog={contenuto} />}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Pubblicati ({pubblicati.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pubblicati.length === 0 && <p className="text-sm text-muted-foreground">Nessun changelog pubblicato.</p>}
              {pubblicati.map((c) => (
                <details key={c.id} className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {format(new Date(c.pubblicato_at!), "dd/MM/yyyy HH:mm")} · {c.cambiamenti.length} cambiamenti
                  </summary>
                  <div className="mt-3">
                    <ChangelogContenuto changelog={c} />
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={confermaPubblica} onOpenChange={setConfermaPubblica}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pubblicare il changelog?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutti i colleghi del gestionale lo vedranno una volta al prossimo accesso. Dopo la pubblicazione non si modifica più.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => salva(true)}>Pubblica</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
