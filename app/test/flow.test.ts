import { describe, expect, it } from "vitest";
import { checkFinal, payOrder, supplierVerifies, type Approval } from "../lib/flow";

// A stand-in for tests only. Real payments are recorded separately from the live gateway.
const standIn = (statuses: string[], attributed = true) => {
  const calls: string[] = [];
  const call = async (name: string) => {
    calls.push(name);
    if (name === "prepare_payment") return { pay_to: "0xA", payer: "0xB", token_total_raw: "1000000", eip712: {}, payment_payload: {}, payment_mandate_contents: {}, cart_hash: "c" };
    if (name === "finalize_payment") return { payment_mandate_json: "{}" };
    if (name === "query_payment") return { attribution_verified: attributed, payment: { status: statuses.shift(), tx_signature: "0xT", network: "base-sepolia" } };
    return {};
  };
  return { call, calls };
};

const input = (call: any, approve: (a: Approval) => Promise<boolean>) => ({
  call, flowId: "f", paymentRequestId: "p", payer: "0xB", protocol: "eip3009" as const,
  merchantName: "Kinnu", invoicePayTo: "0xA", maxTokenRaw: 1000000n, approve, signTypedData: async () => "0xS", pollMs: 0,
});

describe("payOrder", () => {
  it("asks twice and keeps polling until a stop status", async () => {
    const asked: string[] = [];
    const { call, calls } = standIn(["payment-submitted", "payment-timeout", "payment-safe"]);
    const r = await payOrder(input(call, async (a) => (asked.push(a.step), true)));
    expect(asked).toEqual(["sign", "submit"]);
    expect(r.outcome).toBe("payment-safe");
    expect(calls.filter((c) => c === "create_order")).toHaveLength(0);
    expect(calls.filter((c) => c === "submit_payment")).toHaveLength(1);
  });

  it("doesn't sign when declined", async () => {
    const { call, calls } = standIn([]);
    const r = await payOrder(input(call, async () => false));
    expect(r.outcome).toBe("declined");
    expect(calls).toEqual(["prepare_payment"]);
  });

  it("doesn't submit when the second approval is declined", async () => {
    const { call, calls } = standIn([]);
    const r = await payOrder(input(call, async (a) => a.step === "sign"));
    expect(r.outcome).toBe("declined");
    expect(calls).not.toContain("submit_payment");
  });
});

describe("quote check", () => {
  it("won't ask to sign when the payee differs from the invoice", async () => {
    const { call } = standIn([]);
    const r = await payOrder({ ...input(call, async () => true), invoicePayTo: "0xZ" });
    expect(r.outcome).toBe("quote-mismatch");
  });
  it("won't ask to sign above the invoice amount", async () => {
    const { call } = standIn([]);
    const r = await payOrder({ ...input(call, async () => true), maxTokenRaw: 999999n });
    expect(r.outcome).toBe("quote-mismatch");
  });
});

describe("supplierVerifies", () => {
  const answer = (status: string, to: string, attribution_verified = true) => async () => ({ attribution_verified, payment: { status, to_pay_address: to } });
  it("needs on-chain, attributed and its own wallet", async () => {
    expect(await supplierVerifies(answer("payment-safe", "0xaA"), "f", "K", "0xAa")).toBe(true);
    expect(await supplierVerifies(answer("payment-safe", "0xBb"), "f", "K", "0xAa")).toBe(false);
    expect(await supplierVerifies(answer("payment-safe", "0xAa", false), "f", "K", "0xAa")).toBe(false);
    expect(await supplierVerifies(answer("payment-included", "0xAa"), "f", "K", "0xAa")).toBe(false);
  });
});

describe("checkFinal", () => {
  const safe = { flowId: "f", paymentRequestId: "p", outcome: "payment-safe" as const, attributionVerified: true, raw: null };
  it("moves to finalized when the gateway says so", async () => {
    const { call } = standIn(["payment-finalized"]);
    expect((await checkFinal(call, safe, "Kinnu")).outcome).toBe("payment-finalized");
  });
  it("keeps safe, never final, if the gateway stops answering", async () => {
    const call = async () => { throw new Error("gone"); };
    expect((await checkFinal(call, safe, "Kinnu")).outcome).toBe("payment-safe");
  });
});
