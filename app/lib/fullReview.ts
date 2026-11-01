import { readInvoicePdf } from "./reader";
import type { InvoiceRead } from "./readInvoice";

/** The model reads the rendered page and can add concerns or correct fields. It can never clear a warning or approve anything. */
export async function addAiRead(review: InvoiceRead, bytes: Uint8Array, expected: { payTo?: string; amount?: number }) {
  const ai = await readInvoicePdf(Buffer.from(bytes).toString("base64"));
  const warnings = [...review.warnings];
  const { payTo, amount } = expected;
  if (payTo && ai.payTo && ai.payTo.toLowerCase() !== payTo.toLowerCase() && !warnings.some((w) => w.kind === "changed-wallet")) {
    warnings.push({ kind: "changed-wallet", message: `Payment wallet changed. You expected ${payTo}. This invoice asks for ${ai.payTo}.` });
  }
  if (amount !== undefined && Number.isFinite(amount) && ai.amountUsdCents !== Math.round(amount * 100) && !warnings.some((w) => w.kind === "wrong-amount")) {
    warnings.push({ kind: "wrong-amount", message: `You agreed ${amount}, this asks for ${ai.amountUsdCents / 100}.` });
  }
  return {
    invoiceNumber: ai.invoiceNumber,
    supplierName: ai.supplierName,
    payTo: ai.payTo,
    amount: ai.amountUsdCents / 100,
    warnings: warnings.filter((w) => !(ai.payTo && w.kind === "no-wallet") && !(ai.amountUsdCents && w.kind === "no-amount")),
    doubts: ai.doubts,
    notes: ai.notes,
  };
}
