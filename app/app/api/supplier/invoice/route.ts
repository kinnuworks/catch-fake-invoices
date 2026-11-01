import { NextResponse } from "next/server";
import { demoSupplier } from "../../../../lib/demo";
import { SupplierAgent } from "../../../../lib/supplier";

const agent = new SupplierAgent(
  demoSupplier.account,
  demoSupplier.wallet,
  [{ orderId: "PO-1042", amountUsdCents: 45_000n, description: "Logo and brand kit", work: "Brand kit files" }],
  "Kinnu",
);

/** A public supplier agent: ask it for an invoice on an order and it signs one. It uses a demo key with no funds. */
export async function GET(request: Request) {
  const order = new URL(request.url).searchParams.get("order") ?? "PO-1042";
  try {
    const { invoice, signature } = await agent.requestInvoice(order);
    return NextResponse.json({
      invoice: { ...invoice, amountUsdCents: invoice.amountUsdCents.toString(), issuedAt: invoice.issuedAt.toString() },
      signature,
      note: "Demo supplier agent. The key holds no funds and changes when the server restarts.",
    });
  } catch {
    return NextResponse.json({ error: `No order ${order}. Try PO-1042.` }, { status: 404 });
  }
}
