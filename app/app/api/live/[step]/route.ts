import { NextResponse } from "next/server";

const STEPS = new Set(["quote", "sign", "submit", "status"]);

// HSP only answers allowlisted addresses, so the payment runs on a separate machine and this passes the steps along.
export async function POST(request: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const relay = process.env.RELAY_URL;
  if (!STEPS.has(step)) return NextResponse.json({ error: "Unknown step" }, { status: 404 });
  if (!relay) return NextResponse.json({ error: "offline" }, { status: 503 });
  try {
    const answer = await fetch(`${relay}/${step}`, {
      method: "POST",
      headers: {
        "x-relay-key": process.env.RELAY_KEY ?? "",
        "x-visitor": request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      },
      body: await request.text(),
      signal: AbortSignal.timeout(40_000),
    });
    const json = await answer.json().catch(() => ({ error: "offline" }));
    return NextResponse.json(json, { status: answer.status });
  } catch {
    return NextResponse.json({ error: "offline" }, { status: 503 });
  }
}
