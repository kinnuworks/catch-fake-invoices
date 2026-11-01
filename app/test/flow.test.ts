import { describe, expect, it } from "vitest";
import { checkFinal, payOrder, supplierShouldDeliver, type Approval } from "../lib/flow";

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
  merchantName: "Kinnu", approve, signTypedData: async () => "0xS", pollMs: 0,
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

describe("supplierShouldDeliver", () => {
  const base = { flowId: "f", paymentRequestId: "p", raw: null };
  it("needs on-chain, attributed and the right payee", () => {
    const ok = { ...base, outcome: "payment-safe" as const, attributionVerified: true };
    expect(supplierShouldDeliver(ok, "0xAa", "0xaA")).toBe(true);
    expect(supplierShouldDeliver(ok, "0xAa", "0xBb")).toBe(false);
    expect(supplierShouldDeliver({ ...ok, attributionVerified: false }, "0xAa", "0xAa")).toBe(false);
    expect(supplierShouldDeliver({ ...ok, outcome: "pending" }, "0xAa", "0xAa")).toBe(false);
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
