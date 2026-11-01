import { NextResponse } from "next/server";
import { readInvoicePdf } from "../../../lib/reader";
import { reviewInvoice } from "../../../lib/readInvoice";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF invoice." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 5 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const payTo = String(form?.get("payTo") ?? "").trim() || undefined;
  const amountText = String(form?.get("amount") ?? "").trim();
  const amount = amountText ? Number(amountText) : undefined;

  let review;
  try {
    review = await reviewInvoice(bytes, { payTo, amount: Number.isFinite(amount) ? amount : undefined });
  } catch (error) {
    console.error("PDF read failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "That file couldn't be read as a PDF." }, { status: 422 });
  }

  // The model reads the rendered page, so it catches what the rules can't. It can raise concerns
  // and correct fields, but it can never clear a warning or approve anything.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ...review, doubts: [], aiRead: "off" });
  }
  try {
    const ai = await readInvoicePdf(Buffer.from(bytes).toString("base64"));
    const warnings = [...review.warnings];
    if (payTo && ai.payTo && ai.payTo.toLowerCase() !== payTo.toLowerCase() && !warnings.some((w) => w.kind === "changed-wallet")) {
      warnings.push({ kind: "changed-wallet", message: `Payment wallet changed. You expected ${payTo}. This invoice asks for ${ai.payTo}.` });
    }
    if (amount !== undefined && ai.amountUsdCents !== Math.round(amount * 100) && !warnings.some((w) => w.kind === "wrong-amount")) {
      warnings.push({ kind: "wrong-amount", message: `You agreed ${amount}, this asks for ${ai.amountUsdCents / 100}.` });
    }
    return NextResponse.json({
      invoiceNumber: ai.invoiceNumber,
      supplierName: ai.supplierName,
      payTo: ai.payTo,
      amount: ai.amountUsdCents / 100,
      warnings: warnings.filter((w) => !(ai.payTo && w.kind === "no-wallet") && !(ai.amountUsdCents && w.kind === "no-amount")),
      doubts: ai.doubts,
      aiRead: "ok",
    });
  } catch (error) {
    console.error("AI read failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ...review, doubts: [], aiRead: "failed" });
  }
}
