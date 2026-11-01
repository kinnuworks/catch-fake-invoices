export type PdfRead = { visibleText: string; hiddenText: string[]; pages: number };

// pdf.js expects these browser classes when it loads. We only read text and never draw, so empty ones do.
async function loadPdfJs() {
  const g = globalThis as Record<string, unknown>;
  for (const name of ["DOMMatrix", "ImageData", "Path2D"]) g[name] ??= class {};
  g.pdfjsWorker ??= await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

const nearWhite = (rgb: number[]) => rgb.every((c) => c >= 0.8);

/** Separates what a person sees from text drawn invisible, off the page, too small or nearly white, which only software reads. */
export async function readPdf(bytes: Uint8Array): Promise<PdfRead> {
  const { getDocument, OPS } = await loadPdfJs();
  const doc = await getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
  const visible: string[] = [];
  const hidden: string[] = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { fnArray, argsArray } = await page.getOperatorList();
    let rgb = [0, 0, 0];
    let size = 12;
    let scale = 1;
    let renderMode = 0;
    let x = 0;
    let y = 0;
    const [left, bottom, right, top] = page.view;
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];
      if (fn === OPS.setFillRGBColor) {
        // pdf.js gives either a hex string or numbers from 0 to 255, depending on version.
        rgb = typeof args[0] === "string"
          ? [1, 3, 5].map((p) => parseInt(args[0].slice(p, p + 2), 16) / 255)
          : [...args].slice(0, 3).map((c: number) => c / 255);
      } else if (fn === OPS.setFillGray) {
        rgb = [args[0], args[0], args[0]];
      } else if (fn === OPS.setTextRenderingMode) {
        renderMode = args[0];
      } else if (fn === OPS.setFont) {
        size = args[1];
      } else if (fn === OPS.setTextMatrix) {
        const matrix: number[] = Array.isArray(args[0]) || ArrayBuffer.isView(args[0]) ? Array.from(args[0] as ArrayLike<number>) : args;
        scale = Math.abs(matrix[0] ?? 1);
        x = matrix[4] ?? 0;
        y = matrix[5] ?? 0;
      } else if (fn === OPS.showText) {
        const text = args[0].map((g: any) => g?.unicode ?? "").join("");
        if (!text.trim()) continue;
        (renderMode === 3 || x < left || x >= right || y < bottom || y >= top || nearWhite(rgb) || Math.abs(size) * scale < 3 ? hidden : visible).push(text);
      }
    }
  }
  return { visibleText: visible.join("\n"), hiddenText: hidden, pages: doc.numPages };
}
