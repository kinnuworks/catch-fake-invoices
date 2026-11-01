import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverSigner } from "../lib/invoice";
import { SupplierAgent } from "../lib/supplier";

const account = privateKeyToAccount(generatePrivateKey());
const wallet = privateKeyToAccount(generatePrivateKey()).address;
const orders = [{ orderId: "PO-1", amountUsdCents: 100n, description: "Report", work: "the report" }];
const paid = (to: string, status = "payment-safe") => async () => ({ attribution_verified: true, payment: { status, to_pay_address: to } });
const agent = () => new SupplierAgent(account, wallet, orders, "Kinnu");

describe("SupplierAgent", () => {
  it("signs its own invoice from an order", async () => {
    const signed = await agent().requestInvoice("PO-1");
    expect(await recoverSigner(signed)).toBe(account.address);
    expect(signed.invoice.amountUsdCents).toBe(100n);
  });
  it("refuses an order it doesn't have", async () => {
    await expect(agent().requestInvoice("PO-9")).rejects.toThrow();
  });
  it("delivers only after the gateway confirms, and only once", async () => {
    const a = agent();
    const { invoice } = await a.requestInvoice("PO-1");
    expect((await a.deliver(invoice.invoiceNumber, "f", paid(wallet, "payment-included"))).delivered).toBe(false);
    expect((await a.deliver(invoice.invoiceNumber, "f", paid(wallet))).delivered).toBe(true);
    expect((await a.deliver(invoice.invoiceNumber, "f", paid(wallet))).delivered).toBe(false);
  });
  it("won't deliver for money sent elsewhere", async () => {
    const a = agent();
    const { invoice } = await a.requestInvoice("PO-1");
    expect((await a.deliver(invoice.invoiceNumber, "f", paid("0x1111111111111111111111111111111111111111"))).delivered).toBe(false);
  });
});
