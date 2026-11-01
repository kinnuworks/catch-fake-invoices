import { STOP_STATUSES } from "./hsp";

type Call = (name: string, args?: Record<string, unknown>) => Promise<any>;

export type Approval = { step: "sign" | "submit"; payTo: string; payer: string; tokenTotalRaw: string };

export type PayInput = {
  call: Call;
  flowId: string;
  paymentRequestId: string;
  payer: string;
  protocol: "eip3009" | "permit2";
  merchantName: string;
  approve: (a: Approval) => Promise<boolean>;
  signTypedData: (eip712: any) => Promise<string>;
  pollMs?: number;
  maxPolls?: number;
};

export type PayResult = {
  outcome: "declined" | "pending" | "payment-safe" | "payment-finalized" | "payment-failed";
  attributionVerified: boolean;
  txHash?: string;
  network?: string;
  flowId: string;
  paymentRequestId: string;
  raw: unknown;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The guide's sequence: prepare, approve, sign, finalize, approve, submit, then poll the same payment. */
export async function payOrder(input: PayInput): Promise<PayResult> {
  const { call, flowId, paymentRequestId, payer, protocol, merchantName, approve } = input;
  const base = { flowId, paymentRequestId, attributionVerified: false };

  const prepared = await call("prepare_payment", { flow_id: flowId, payer_address: payer, protocol });
  const details = { payTo: prepared.pay_to, payer: prepared.payer, tokenTotalRaw: prepared.token_total_raw };

  if (!(await approve({ step: "sign", ...details }))) return { ...base, outcome: "declined", raw: prepared };
  const signature = await input.signTypedData(prepared.eip712);

  const finalized = await call("finalize_payment", {
    signature,
    payment_payload: prepared.payment_payload,
    payment_mandate_contents: prepared.payment_mandate_contents,
    cart_hash: prepared.cart_hash,
  });

  if (!(await approve({ step: "submit", ...details }))) return { ...base, outcome: "declined", raw: finalized };
  await call("submit_payment", { payment_mandate_json: finalized.payment_mandate_json });

  return pollPayment(call, flowId, paymentRequestId, merchantName, input.pollMs ?? 15_000, input.maxPolls ?? 40);
}

export async function pollPayment(
  call: Call,
  flowId: string,
  paymentRequestId: string,
  merchantName: string,
  pollMs = 15_000,
  maxPolls = 40,
): Promise<PayResult> {
  let last: any;
  for (let i = 0; i < maxPolls; i++) {
    if (i > 0) await sleep(pollMs);
    last = await call("query_payment", { flow_id: flowId, expected_merchant_name: merchantName });
    const status = last.payment?.status ?? last.status;
    if (STOP_STATUSES.includes(status)) {
      return {
        outcome: status,
        attributionVerified: last.attribution_verified === true,
        txHash: last.payment?.tx_signature || undefined,
        network: last.payment?.network,
        flowId,
        paymentRequestId,
        raw: last,
      };
    }
  }
  return { outcome: "pending", attributionVerified: false, flowId, paymentRequestId, raw: last };
}

/** The supplier's agent delivers only on its own query: right payee, right amount, attributed, on-chain. */
export function supplierShouldDeliver(result: PayResult, expectedPayTo: string, paidTo?: string): boolean {
  const onChain = result.outcome === "payment-safe" || result.outcome === "payment-finalized";
  return onChain && result.attributionVerified && !!paidTo && paidTo.toLowerCase() === expectedPayTo.toLowerCase();
}
