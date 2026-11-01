import { NextResponse } from "next/server";
import { allowAiRead } from "../../../lib/aiLimit";
import { addAiRead } from "../../../lib/fullReview";
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
  if (form?.get("ai") !== "1") {
    return NextResponse.json({ ...review, doubts: [], aiRead: "off" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ...review, doubts: [], aiRead: "unavailable" });
  }
  if (!allowAiRead(request)) {
    return NextResponse.json({ ...review, doubts: [], aiRead: "limited" });
  }
  try {
    return NextResponse.json({ ...(await addAiRead(review, bytes, { payTo, amount })), aiRead: "ok" });
  } catch (error) {
    console.error("AI read failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ...review, doubts: [], aiRead: "failed" });
  }
}
