import { Globe, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssistenteWebChatPanel from "@/components/documentale/AssistenteWebChatPanel";
import LibreriaCgaChatPanel from "@/components/documentale/LibreriaCgaChatPanel";
import CbBotLogo from "@/components/shared/CbBotLogo";

type Props = {
  consultazioneMode?: boolean;
};

export default function AssistenteGaranzieSection({ consultazioneMode = false }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <CbBotLogo className="h-10 w-auto shrink-0" />
        <div>
          <h2 className="text-lg font-semibold sr-only">Cb Bot</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            <strong>Assistente Web</strong> — chat sul web stile ChatGPT, senza accesso a polizze o dati interni.
            {" "}
            <strong>Libreria CGA</strong> — garanzie, massimali ed esclusioni dal catalogo CBnet.
            {consultazioneMode
              ? " Salva le tue ricerche e condividile con il team."
              : " Salva le ricerche utili e condividile con il team."}
          </p>
        </div>
      </div>

      <Tabs defaultValue="assistente-web" className="w-full">
        <TabsList>
          <TabsTrigger value="assistente-web" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Assistente Web
          </TabsTrigger>
          <TabsTrigger value="libreria-cga" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Libreria CGA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistente-web" className="mt-4">
          <AssistenteWebChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>

        <TabsContent value="libreria-cga" className="mt-4">
          <LibreriaCgaChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
