import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Changelog = {
  id: string;
  pubblicato_at: string | null;
  cambiamenti: string[];
  bug_in_carico: string[];
  problemi_noti: string[];
};

const SEZIONI = [
  ["cambiamenti", null],
  ["bug_in_carico", "Bug presi in carico"],
  ["problemi_noti", "Problemi noti"],
] as const;

/**
 * Popup "Ultimi cambiamenti" del gestionale: l'ultimo changelog pubblicato, una sola volta per utente
 * (la lettura è salvata in changelog_letture alla chiusura).
 * Anteprima per l'admin con ?changelog=anteprima: mostra anche la bozza più recente e non registra la lettura.
 */
export default function ChangelogPopup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const anteprima = params.get("changelog") === "anteprima";
  const [chiuso, setChiuso] = useState<string | null>(null);

  const { data: changelog } = useQuery({
    queryKey: ["changelog-da-mostrare", user?.id, anteprima],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async (): Promise<Changelog | null> => {
      let q = supabase
        .from("changelog" as never)
        .select("id, pubblicato_at, cambiamenti, bug_in_carico, problemi_noti")
        .order("pubblicato_at", { ascending: false, nullsFirst: anteprima })
        .order("creato_at", { ascending: false })
        .limit(1);
      if (!anteprima) q = q.not("pubblicato_at", "is", null);
      const { data, error } = await q.maybeSingle();
      if (error || !data) return null;
      const c = data as unknown as Changelog;
      if (anteprima) return c;
      const { data: letto } = await supabase
        .from("changelog_letture" as never)
        .select("changelog_id")
        .eq("changelog_id", c.id)
        .maybeSingle();
      return letto ? null : c;
    },
  });

  if (!changelog || chiuso === changelog.id) return null;

  const chiudi = async () => {
    setChiuso(changelog.id);
    if (anteprima) return;
    // ignoreDuplicates: chiuso in due schede insieme non dà errore
    await supabase
      .from("changelog_letture" as never)
      .upsert({ changelog_id: changelog.id } as never, { onConflict: "user_id,changelog_id", ignoreDuplicates: true });
    qc.invalidateQueries({ queryKey: ["changelog-da-mostrare"] });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && chiudi()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Ultimi cambiamenti effettuati al portale
          </DialogTitle>
          {anteprima && (
            <DialogDescription>
              Anteprima{changelog.pubblicato_at ? "" : " della bozza (non ancora pubblicata)"}: chiudendo non viene registrata la lettura.
            </DialogDescription>
          )}
        </DialogHeader>

        <ChangelogContenuto changelog={changelog} />

        <DialogFooter>
          <Button onClick={chiudi}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Corpo del changelog (popup e anteprima nell'editor): le sezioni vuote non compaiono. */
export function ChangelogContenuto({ changelog }: { changelog: Pick<Changelog, "cambiamenti" | "bug_in_carico" | "problemi_noti"> }) {
  return (
    <div className="space-y-5 text-sm">
      {SEZIONI.map(([campo, titolo]) =>
        changelog[campo].length ? (
          <section key={campo} className="space-y-2">
            {titolo && <h3 className="font-semibold text-foreground">{titolo}</h3>}
            <ul className="list-disc space-y-1 pl-5 text-foreground/90">
              {changelog[campo].map((voce, i) => (
                <li key={i}>{voce}</li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
