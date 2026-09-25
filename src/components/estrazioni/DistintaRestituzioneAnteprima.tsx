import type { DistintaRestituzioneModel } from "@/lib/restituzioneOriginali";

function MetaLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="text-[11px] leading-snug text-slate-600">
      <span className="text-slate-400">{label} </span>
      {value}
    </p>
  );
}

export function DistintaRestituzioneAnteprima({
  model,
  pageLabel,
}: {
  model: DistintaRestituzioneModel;
  pageLabel?: string;
}) {
  return (
    <article
      data-testid="distinta-anteprima"
      className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-md border bg-[#fbfdfc] text-slate-800 shadow-sm"
    >
      <div className="h-1.5 bg-[#0d5952]" />
      <div className="space-y-4 p-5 sm:p-6">
        {pageLabel && (
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{pageLabel}</p>
        )}
        <header className="flex items-start justify-between gap-3 border-b border-[#0d5952] pb-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-[#0d4742]">CBnet</span>
              <span className="text-xs text-slate-500">{model.mittente.ragioneSociale}</span>
            </div>
            {(model.mittente.sedeNome || model.mittente.indirizzo || model.mittente.capCitta) && (
              <p className="mt-1 text-[10px] text-slate-500">
                {[model.mittente.sedeNome, model.mittente.indirizzo, model.mittente.capCitta]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-[#0d4742]">{model.protocollo}</p>
            <p className="text-[11px] text-slate-500">{model.dataLabel}</p>
          </div>
        </header>

        <h2 className="text-base font-bold text-[#0d4742]">{model.titolo}</h2>

        <section className="rounded-md border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
          <p className="text-[10px] italic text-slate-500">Spett.le</p>
          <p className="text-sm font-semibold">{model.destinatario.nome}</p>
          <MetaLine label="" value={model.destinatario.indirizzo} />
          <MetaLine label="" value={model.destinatario.capCitta} />
        </section>

        <div className="space-y-1">
          <p className="text-[13px] font-semibold">Oggetto: {model.oggetto}</p>
          {model.clientiLabel && (
            <p className="text-xs text-slate-500">Clienti: {model.clientiLabel}</p>
          )}
          <p className="text-[12px] leading-relaxed text-slate-700">{model.intro}</p>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[520px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#0d5952] text-left text-white">
                <th className="px-2 py-1.5 font-medium">N.</th>
                <th className="px-2 py-1.5 font-medium">Cliente</th>
                <th className="px-2 py-1.5 font-medium">N. titolo</th>
                <th className="px-2 py-1.5 font-medium">Tipo</th>
                <th className="px-2 py-1.5 font-medium">Documento</th>
                <th className="px-2 py-1.5 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-3 italic text-slate-500">
                    Nessun documento originale in elenco — vedere le note.
                  </td>
                </tr>
              ) : (
                model.rows.map((r, i) => (
                  <tr key={`${r.n}-${r.documento}`} className={i % 2 ? "bg-emerald-50/50" : "bg-white"}>
                    <td className="px-2 py-1.5 align-top">{r.n}</td>
                    <td className="px-2 py-1.5 align-top">{r.cliente}</td>
                    <td className="px-2 py-1.5 align-top font-mono text-[10px]">{r.numeroTitolo}</td>
                    <td className="px-2 py-1.5 align-top">{r.tipo}</td>
                    <td className="px-2 py-1.5 align-top break-all">{r.documento}</td>
                    <td className="px-2 py-1.5 align-top whitespace-nowrap">{r.data}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {model.note && (
          <section className="rounded-md border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-[#0d4742]">Note</p>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed">{model.note}</p>
          </section>
        )}

        <p className="text-[12px]">{model.chiusura}</p>
        <div className="grid grid-cols-2 gap-6 pt-2 text-[11px] text-slate-500">
          <div>
            <p className="font-semibold">Per Consulbrokers</p>
            <div className="mt-6 border-t border-slate-300" />
          </div>
          <div>
            <p className="font-semibold">Per l&apos;agenzia</p>
            <div className="mt-6 border-t border-slate-300" />
          </div>
        </div>
        {model.generatoDa && (
          <p className="text-[10px] italic text-slate-400">Compilata da {model.generatoDa}</p>
        )}
      </div>
    </article>
  );
}

export default DistintaRestituzioneAnteprima;
