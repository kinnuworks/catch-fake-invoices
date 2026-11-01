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
  } catch {
    return NextResponse.json({ error: "That file couldn't be read as a PDF." }, { status: 422 });
  }

  // The model only adds doubts for a person to read. It can't clear a warning or approve anything.
  let doubts: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    doubts = await readInvoicePdf(Buffer.from(bytes).toString("base64")).then((r) => r.doubts).catch(() => []);
  }
  return NextResponse.json({ ...review, doubts });
}
