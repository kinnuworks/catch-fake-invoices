import { NextResponse } from "next/server";
import { allowAiRead } from "../../../lib/aiLimit";
import { buildChallengePdf, HIDE, KNOWN_WALLET, type Hide } from "../../../lib/challengePdf";
import { addAiRead } from "../../../lib/fullReview";
import { reviewInvoice } from "../../../lib/readInvoice";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const hide = body?.hide as Hide;
  if (!text) return NextResponse.json({ error: "Write something to hide on the invoice." }, { status: 400 });
  if (!(hide in HIDE)) return NextResponse.json({ error: "Choose how to hide it." }, { status: 400 });

  const bytes = await buildChallengePdf(text, hide);
  const expected = { payTo: KNOWN_WALLET, amount: 450 };
  const review = await reviewInvoice(bytes, expected);
  const base = { warnings: review.warnings, doubts: [] as string[] };
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ...base, aiRead: "unavailable" });
  if (!allowAiRead(request)) return NextResponse.json({ ...base, aiRead: "limited" });
  try {
    const full = await addAiRead(review, bytes, expected);
    return NextResponse.json({ warnings: full.warnings, doubts: full.doubts, aiRead: "ok" });
  } catch (error) {
    console.error("AI read failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ...base, aiRead: "failed" });
  }
}
