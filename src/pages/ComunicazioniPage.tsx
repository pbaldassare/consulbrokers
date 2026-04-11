import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CanaliSidebar from "@/components/chat/CanaliSidebar";
import ChatArea from "@/components/chat/ChatArea";
import NuovaConversazioneDialog from "@/components/chat/NuovaConversazioneDialog";

export default function ComunicazioniPage() {
  const { profile } = useAuth();
  const [canaleAttivoId, setCanaleAttivoId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ambito, setAmbito] = useState<"interno" | "contestuale">("interno");

  if (!profile) return null;

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <div className="w-72 shrink-0">
        <CanaliSidebar
          canaleAttivoId={canaleAttivoId}
          onSelectCanale={setCanaleAttivoId}
          onNuovaConversazione={() => setDialogOpen(true)}
          userId={profile.id}
          ambito={ambito}
          onAmbitoChange={(a) => { setAmbito(a); setCanaleAttivoId(null); }}
          showAmbitoToggle={true}
        />
      </div>

      <ChatArea canaleId={canaleAttivoId} />

      <NuovaConversazioneDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ambito={ambito}
        onCreated={(id) => {
          setCanaleAttivoId(id);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
