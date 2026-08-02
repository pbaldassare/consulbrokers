import { Globe, Sparkles, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MercatoWebChatPanel from "@/components/documentale/MercatoWebChatPanel";
import LibreriaCgaChatPanel from "@/components/documentale/LibreriaCgaChatPanel";

type Props = {
  consultazioneMode?: boolean;
};

export default function AssistenteGaranzieSection({ consultazioneMode = false }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Sparkles className="h-6 w-6 text-primary shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold">Assistente Assicurativo</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Due modalità: ricerca sul <strong>mercato assicurativo</strong> via web, oppure consultazione
            della <strong>Libreria CGA</strong> interna (garanzie, massimali, esclusioni).
            {consultazioneMode
              ? " Consulta le ricerche condivise dal team; per salvare nuove ricerche usa il gestionale."
              : " Salva le ricerche utili e condividile con tutto il team."}
          </p>
        </div>
      </div>

      <Tabs defaultValue="mercato-web" className="w-full">
        <TabsList>
          <TabsTrigger value="mercato-web" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Mercato Web
          </TabsTrigger>
          <TabsTrigger value="libreria-cga" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Libreria CGA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mercato-web" className="mt-4">
          <MercatoWebChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>

        <TabsContent value="libreria-cga" className="mt-4">
          <LibreriaCgaChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
