import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Invoice } from "./invoice";

/** A plain PDF of a signed invoice, as a supplier's agent would attach it. */
export async function invoiceToPdf(invoice: Invoice) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = [
    "INVOICE",
    `Invoice number: ${invoice.invoiceNumber}`,
    `From: Supplier agent ${invoice.supplier.slice(0, 8)}`,
    `Order: ${invoice.orderId}`,
    `For: ${invoice.description}`,
    `Pay to: ${invoice.payTo}`,
    `Total: $${(Number(invoice.amountUsdCents) / 100).toFixed(2)}`,
  ];
  lines.forEach((text, i) => page.drawText(text, { x: 50, y: 780 - i * 26, size: i ? 12 : 22, font }));
  return doc.save();
}
