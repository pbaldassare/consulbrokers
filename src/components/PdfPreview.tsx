import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
// @ts-ignore - worker as URL
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props {
  data: Uint8Array | null;
}

const PdfPreview = ({ data }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Clone immediately — pdfjs detaches the buffer
    const bytes = data.slice();

    const start = async () => {
      // Wait for the container to mount (Radix Dialog mounts content lazily)
      let tries = 0;
      while (!containerRef.current && tries < 30 && !cancelled) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        tries++;
      }
      const container = containerRef.current;
      if (!container || cancelled) {
        if (!cancelled) {
          setError("Container non disponibile");
          setLoading(false);
        }
        return;
      }
      container.innerHTML = "";
      try {
        const loadingTask = pdfjs.getDocument({
          data: bytes,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "shadow-md mx-auto mb-4 bg-white";
          canvas.style.maxWidth = "100%";
          canvas.style.height = "auto";
          const ctx = canvas.getContext("2d")!;
          container.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
          if (cancelled) return;
        }
      } catch (e: any) {
        console.error("[PdfPreview]", e);
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div className="flex-1 overflow-auto bg-muted/40 p-4">
      {loading && <p className="text-center text-sm text-muted-foreground">Caricamento anteprima…</p>}
      {error && <p className="text-center text-sm text-destructive">Errore: {error}</p>}
      <div ref={containerRef} />
    </div>
  );
};

export default PdfPreview;
