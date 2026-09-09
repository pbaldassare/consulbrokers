import { Globe, BookOpen, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssistenteWebChatPanel from "@/components/documentale/AssistenteWebChatPanel";
import LibreriaCgaChatPanel from "@/components/documentale/LibreriaCgaChatPanel";
import CbBotSitiAutorizzatiPanel from "@/components/documentale/CbBotSitiAutorizzatiPanel";
import CbBotLogo from "@/components/shared/CbBotLogo";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  consultazioneMode?: boolean;
};

export default function AssistenteGaranzieSection({ consultazioneMode = false }: Props) {
  const { isAdmin } = useAuth();
  const showSitiTab = !consultazioneMode && isAdmin;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <CbBotLogo className="h-10 w-auto shrink-0" />
        <div>
          <h2 className="text-lg font-semibold sr-only">Cb Bot</h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            <strong>Assistente Web</strong> — cerca solo sui siti autorizzati dall&apos;admin.
            {" "}
            <strong>Libreria CGA</strong> — garanzie, massimali ed esclusioni dal catalogo CBnet.
            {showSitiTab && (
              <>
                {" "}
                <strong>Siti autorizzati</strong> — elenco dei portali che il bot può interrogare.
              </>
            )}
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
          {showSitiTab && (
            <TabsTrigger value="siti-autorizzati" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Siti autorizzati
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="assistente-web" className="mt-4">
          <AssistenteWebChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>

        <TabsContent value="libreria-cga" className="mt-4">
          <LibreriaCgaChatPanel consultazioneMode={consultazioneMode} />
        </TabsContent>

        {showSitiTab && (
          <TabsContent value="siti-autorizzati" className="mt-4">
            <CbBotSitiAutorizzatiPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
