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
  /** From the checked invoice. The quote must match both before anyone is asked to sign. */
  invoicePayTo: string;
  maxTokenRaw: bigint;
  approve: (a: Approval) => Promise<boolean>;
  signTypedData: (eip712: any) => Promise<string>;
  pollMs?: number;
  maxPolls?: number;
};

export type PayResult = {
  outcome: "declined" | "quote-mismatch" | "pending" | "payment-safe" | "payment-finalized" | "payment-failed";
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

  const prepared = await call("prepare_payment", { flow_id: flowId, payer, protocol });
  const details = { payTo: prepared.pay_to, payer: prepared.payer, tokenTotalRaw: prepared.token_total_raw };

  if (
    String(prepared.pay_to).toLowerCase() !== input.invoicePayTo.toLowerCase() ||
    BigInt(prepared.token_total_raw) > input.maxTokenRaw
  ) {
    return { ...base, outcome: "quote-mismatch", raw: prepared };
  }

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

/** The supplier's agent asks the gateway itself and delivers only if the money is on-chain, attributed and sent to it. */
export async function supplierVerifies(call: Call, flowId: string, merchantName: string, ownWallet: string): Promise<boolean> {
  const answer = await call("query_payment", { flow_id: flowId, expected_merchant_name: merchantName });
  const payment = answer.payment ?? {};
  return (
    (payment.status === "payment-safe" || payment.status === "payment-finalized") &&
    answer.attribution_verified === true &&
    String(payment.to_pay_address ?? "").toLowerCase() === ownWallet.toLowerCase()
  );
}

/** After payment-safe, asks again later for final confirmation. Keeps the safe result if the gateway has no newer answer. */
export async function checkFinal(call: Call, safe: PayResult, merchantName: string): Promise<PayResult> {
  try {
    const later = await pollPayment(call, safe.flowId, safe.paymentRequestId, merchantName, 0, 1);
    return later.outcome === "pending" ? safe : later;
  } catch {
    return safe;
  }
}
