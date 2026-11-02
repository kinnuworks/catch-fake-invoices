import { readPdf } from "./pdf";

export type InvoiceRead = {
  invoiceNumber: string | null;
  supplierName: string | null;
  payTo: string | null;
  amount: number | null;
  warnings: { kind: "hidden-text" | "instruction" | "changed-wallet" | "wrong-amount" | "no-wallet" | "no-amount" | "many-wallets"; message: string }[];
};

const INSTRUCTION = /(ignore|disregard|override|bypass|skip)\b.{0,40}\b(check|instruction|rule|polic|verification)|(approve|pay)\b.{0,40}\b(immediately|without|automatically)|\b(you are|as) an? (ai|agent|assistant)\b|system prompt/i;

const lineValue = (text: string, label: RegExp) => text.match(label)?.[1]?.trim() ?? null;

export function parseInvoiceText(text: string) {
  // A long wallet can wrap across two lines, so join hex fragments first.
  const unwrapped = text.replace(/(0x[a-fA-F0-9]{10,39})\s*\n\s*([a-fA-F0-9]{1,30})(?![a-zA-Z0-9])/g, "$1$2");
  const wallets = unwrapped.match(/0x[a-fA-F0-9]{40}/g) ?? [];
  const totals = [...text.matchAll(/(?:total|amount due|balance due|amount)[^\d]{0,20}\$?\s?([\d,]+(?:\.\d{1,2})?)/gi)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    invoiceNumber: lineValue(text, /(?:invoice|inv)[ \t]*(?:number|no\.?|#)?[ \t]*[:#]?\s*((?=[A-Z-/]*\d)[A-Z0-9][A-Z0-9-/]{2,})/i),
    supplierName: lineValue(text, /(?:from|supplier|vendor|bill from)\s*:\s*(.+)/i),
    payTo: wallets[0] ?? null,
    wallets: [...new Set(wallets.map((w) => w.toLowerCase()))],
    amount: totals.length ? Math.max(...totals) : null,
  };
}

/** Finds problems in an uploaded invoice. It reports only; a person still decides. */
export async function reviewInvoice(
  bytes: Uint8Array,
  expected: { payTo?: string; amount?: number } = {},
): Promise<InvoiceRead> {
  const { visibleText, hiddenText } = await readPdf(bytes);
  const fields = parseInvoiceText(visibleText);
  const warnings: InvoiceRead["warnings"] = [];

  if (hiddenText.length) {
    warnings.push({ kind: "hidden-text", message: `Hidden text a person can't see: "${hiddenText.join(" ").slice(0, 300)}"` });
  }
  if (INSTRUCTION.test([visibleText, ...hiddenText].join(" "))) {
    warnings.push({ kind: "instruction", message: "This invoice contains instructions aimed at software. They were ignored, and only you can approve a payment." });
  }
  if (!fields.payTo) warnings.push({ kind: "no-wallet", message: "No wallet address found on this invoice." });
  if (fields.amount === null) warnings.push({ kind: "no-amount", message: "No total found on this invoice." });
  const strange = fields.wallets.find((w) => w !== expected.payTo?.toLowerCase());
  if (expected.payTo && strange) {
    warnings.push({ kind: "changed-wallet", message: `Payment wallet changed. You expected ${expected.payTo}. This invoice asks for ${strange}.` });
  }
  if (expected.amount !== undefined && fields.amount !== null && expected.amount !== fields.amount) {
    warnings.push({ kind: "wrong-amount", message: `You agreed ${expected.amount}, this asks for ${fields.amount}.` });
  }
  if (fields.wallets.length > 1) {
    warnings.push({ kind: "many-wallets", message: `This invoice shows ${fields.wallets.length} different wallets: ${fields.wallets.join(", ")}.` });
  }
  const { wallets: _wallets, ...read } = fields;
  return { ...read, warnings };
}
