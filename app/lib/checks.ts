import { isAddressEqual, type Address } from "viem";
import { invoiceHash, recoverSigner, type Invoice, type SignedInvoice } from "./invoice";

export type Order = {
  orderId: string;
  supplier: Address;
  amountUsdCents: bigint;
  description: string;
};

export type Supplier = {
  name: string;
  signer: Address;
  knownPayTo: Address;
};

export type History = { paidInvoiceHashes: string[]; paidInvoiceNumbers: string[] };

/** Bit values are written to the ledger, so don't renumber them. */
export const REASONS = {
  BAD_SIGNATURE: 1n << 0n,
  UNKNOWN_SUPPLIER: 1n << 1n,
  CHANGED_WALLET: 1n << 2n,
  NO_MATCHING_ORDER: 1n << 3n,
  WRONG_AMOUNT: 1n << 4n,
  DUPLICATE: 1n << 5n,
} as const;

export type ReasonName = keyof typeof REASONS;

export type Finding = { reason: ReasonName; message: string };

export type Verdict = { hash: string; pass: boolean; reasons: bigint; findings: Finding[] };

const dollars = (cents: bigint) => `$${(Number(cents) / 100).toFixed(2)}`;

export async function checkInvoice(
  signed: SignedInvoice,
  orders: Order[],
  suppliers: Supplier[],
  history: History,
): Promise<Verdict> {
  const { invoice }: { invoice: Invoice } = signed;
  const findings: Finding[] = [];
  const add = (reason: ReasonName, message: string) => findings.push({ reason, message });

  const signer = await recoverSigner(signed);
  const supplier = suppliers.find((s) => isAddressEqual(s.signer, invoice.supplier));

  if (!supplier) {
    add("UNKNOWN_SUPPLIER", "This supplier isn't on your list.");
  } else if (!signer || !isAddressEqual(signer, supplier.signer)) {
    add("BAD_SIGNATURE", `This invoice wasn't signed by ${supplier.name}, or it was changed after signing.`);
  }

  if (supplier && !isAddressEqual(invoice.payTo, supplier.knownPayTo)) {
    add("CHANGED_WALLET", `Payment wallet changed. ${supplier.name}'s usual wallet is ${supplier.knownPayTo}. This invoice asks for ${invoice.payTo}.`);
  }

  const order = orders.find((o) => o.orderId === invoice.orderId);
  if (!order || (supplier && !isAddressEqual(order.supplier, invoice.supplier))) {
    add("NO_MATCHING_ORDER", `No order ${invoice.orderId} exists for this supplier.`);
  } else if (order.amountUsdCents !== invoice.amountUsdCents) {
    add("WRONG_AMOUNT", `Order ${order.orderId} was agreed at ${dollars(order.amountUsdCents)}, this invoice asks for ${dollars(invoice.amountUsdCents)}.`);
  }

  const hash = invoiceHash(invoice);
  if (history.paidInvoiceHashes.includes(hash) || history.paidInvoiceNumbers.includes(invoice.invoiceNumber)) {
    add("DUPLICATE", `Invoice ${invoice.invoiceNumber} has already been paid.`);
  }

  const reasons = findings.reduce((bits, f) => bits | REASONS[f.reason], 0n);
  return { hash, pass: findings.length === 0, reasons, findings };
}
