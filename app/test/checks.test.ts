import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { checkInvoice, REASONS, type History, type Order, type Supplier } from "../lib/checks";
import { signInvoice, type Invoice } from "../lib/invoice";

const account = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const wallet = privateKeyToAccount(generatePrivateKey()).address;
const attacker = privateKeyToAccount(generatePrivateKey()).address;

const suppliers: Supplier[] = [{ name: "Acme", signer: account.address, knownPayTo: wallet }];
const orders: Order[] = [{ orderId: "PO-1", supplier: account.address, amountUsdCents: 12_500n, description: "Design" }];
const clean: History = { paidInvoiceHashes: [], paidInvoiceNumbers: [] };
const base: Invoice = {
  invoiceNumber: "INV-1",
  orderId: "PO-1",
  supplier: account.address,
  payTo: wallet,
  amountUsdCents: 12_500n,
  description: "Design",
  issuedAt: 1n,
};

const run = async (change: Partial<Invoice> = {}, history = clean) =>
  checkInvoice(await signInvoice(account, { ...base, ...change }), orders, suppliers, history);

describe("checkInvoice", () => {
  it("passes a correct invoice", async () => {
    const v = await run();
    expect(v.pass).toBe(true);
    expect(v.reasons).toBe(0n);
  });

  it("stops a changed wallet even when the supplier signed it", async () => {
    const v = await run({ payTo: attacker });
    expect(v.pass).toBe(false);
    expect(v.reasons).toBe(REASONS.CHANGED_WALLET);
  });

  it("stops an invoice edited after signing", async () => {
    const signed = await signInvoice(account, base);
    const v = await checkInvoice(
      { ...signed, invoice: { ...base, amountUsdCents: 99_900n } },
      orders,
      suppliers,
      clean,
    );
    expect(v.reasons & REASONS.BAD_SIGNATURE).toBe(REASONS.BAD_SIGNATURE);
    expect(v.reasons & REASONS.WRONG_AMOUNT).toBe(REASONS.WRONG_AMOUNT);
  });

  it("stops a forged signature", async () => {
    const forged = await signInvoice(other, base);
    const v = await checkInvoice(forged, orders, suppliers, clean);
    expect(v.reasons).toBe(REASONS.BAD_SIGNATURE);
  });

  it("stops a wrong amount", async () => {
    expect((await run({ amountUsdCents: 13_000n })).reasons).toBe(REASONS.WRONG_AMOUNT);
  });

  it("stops an unknown order", async () => {
    expect((await run({ orderId: "PO-9" })).reasons).toBe(REASONS.NO_MATCHING_ORDER);
  });

  it("stops a duplicate, including a reissue with a new date", async () => {
    const first = await run();
    expect((await run({}, { paidInvoiceHashes: [first.hash], paidInvoiceNumbers: [] })).reasons).toBe(REASONS.DUPLICATE);
    expect((await run({ issuedAt: 2n }, { paidInvoiceHashes: [], paidInvoiceNumbers: ["INV-1"] })).reasons).toBe(REASONS.DUPLICATE);
  });

  it("stops an unknown supplier", async () => {
    const v = await checkInvoice(await signInvoice(other, { ...base, supplier: other.address }), orders, suppliers, clean);
    expect(v.reasons & REASONS.UNKNOWN_SUPPLIER).toBe(REASONS.UNKNOWN_SUPPLIER);
  });
});
