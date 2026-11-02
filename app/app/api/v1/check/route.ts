import { NextResponse } from "next/server";
import { checkInvoice } from "../../../../lib/checks";

const DOCS = "POST JSON: { signed: { invoice, signature }, orders: [...], suppliers: [...], history?: { paidInvoiceHashes, paidInvoiceNumbers } }. Amounts are USD cents as strings. It never approves or pays: it returns pass or the reasons to stop.";

export function GET() {
  return NextResponse.json({ about: DOCS });
}

// Any agent can call this before it pays. Nothing is stored.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const invoice = body?.signed?.invoice;
  if (!invoice || !body?.signed?.signature || !Array.isArray(body?.orders) || !Array.isArray(body?.suppliers)) {
    return NextResponse.json({ error: DOCS }, { status: 400 });
  }
  try {
    const signed = { signature: body.signed.signature, invoice: { ...invoice, amountUsdCents: BigInt(invoice.amountUsdCents), issuedAt: BigInt(invoice.issuedAt) } };
    const orders = body.orders.map((o: any) => ({ ...o, amountUsdCents: BigInt(o.amountUsdCents) }));
    const verdict = await checkInvoice(signed, orders, body.suppliers, body.history ?? { paidInvoiceHashes: [], paidInvoiceNumbers: [] });
    return NextResponse.json({ hash: verdict.hash, pass: verdict.pass, reasons: verdict.reasons.toString(), findings: verdict.findings });
  } catch {
    return NextResponse.json({ error: `The invoice couldn't be read. ${DOCS}` }, { status: 422 });
  }
}
