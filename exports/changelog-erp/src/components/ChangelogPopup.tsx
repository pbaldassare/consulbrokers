import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import type { Components } from "react-markdown";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
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

/** Tollera "##Titolo" e "-voce" senza spazio (il markdown standard lo richiede). */
const normalizzaMarkdown = (t: string) =>
  t.replace(/^(#{1,6})(?=[^#\s])/gm, "$1 ").replace(/^(\s*)-(?=[^\s-])/gm, "$1- ");

/** Stili espliciti: Tailwind Preflight azzera heading/liste; `prose` da solo non basta se il plugin manca. */
const md = (Tag: keyof JSX.IntrinsicElements, className: string) =>
  ({ children, node: _node, ...props }: { children?: ReactNode; node?: unknown } & Record<string, unknown>) => (
    <Tag className={className} {...props}>{children}</Tag>
  );

const markdownComponents: Components = {
  h1: md("h1", "mb-2 mt-3 text-xl font-bold tracking-tight text-foreground first:mt-0"),
  h2: md("h2", "mb-2 mt-3 text-lg font-semibold tracking-tight text-foreground first:mt-0"),
  h3: md("h3", "mb-1.5 mt-2.5 text-base font-semibold text-foreground first:mt-0"),
  h4: md("h4", "mb-1.5 mt-2 text-sm font-semibold text-foreground first:mt-0"),
  p: md("p", "my-1.5 leading-relaxed text-foreground/90"),
  ul: md("ul", "my-1.5 list-disc space-y-0.5 pl-5 text-foreground/90"),
  ol: md("ol", "my-1.5 list-decimal space-y-0.5 pl-5 text-foreground/90"),
  li: md("li", "my-0 leading-relaxed"),
  strong: md("strong", "font-semibold text-foreground"),
  em: md("em", "italic"),
  code: md("code", "rounded bg-muted px-1 py-0.5 font-mono text-[13px]"),
  pre: md("pre", "my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-[13px]"),
  blockquote: md("blockquote", "my-2 border-l-2 border-border pl-3 italic text-muted-foreground"),
  hr: md("hr", "my-3 border-border"),
  a: ({ children, href, node: _node, ...props }) => (
    <a
      {...props}
      href={href}
      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

/**
 * Corpo del changelog (popup e anteprima nell'editor). Ogni categoria è testo markdown
 * (# titolo, ## sottotitolo, - elenco, **grassetto**); le categorie vuote non compaiono.
 * react-markdown non esegue HTML raw (niente script); i link restano solo http/https/mailto.
 */
export function ChangelogContenuto({ changelog }: { changelog: Pick<Changelog, "cambiamenti" | "bug_in_carico" | "problemi_noti"> }) {
  return (
    <div className="space-y-5 text-sm">
      {SEZIONI.map(([campo, titolo]) => {
        const testo = changelog[campo].join("\n").trim();
        return testo ? (
          <section key={campo} className="space-y-2">
            {titolo && <h3 className="font-semibold text-foreground">{titolo}</h3>}
            <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mb-2 prose-headings:mt-3 prose-p:my-1 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={defaultUrlTransform}
                components={markdownComponents}
              >
                {normalizzaMarkdown(testo)}
              </ReactMarkdown>
            </div>
          </section>
        ) : null;
      })}
    </div>
  );
}
