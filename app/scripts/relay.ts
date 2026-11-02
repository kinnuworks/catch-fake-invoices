// Runs next to the HSP allowlist so a visitor can make one small real payment.
// The recipient and amount are fixed here, so a caller can only spend this wallet's test USDC on this one invoice type.
//   tsx --env-file=.env scripts/relay.ts
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { checkInvoice } from "../lib/checks";
import { pollPayment, prepareOrder, signOrder } from "../lib/flow";
import { connectHsp } from "../lib/hsp";
import { invoiceHash } from "../lib/invoice";
import { ledger } from "../lib/ledger";
import { createOrder, maxTokenRaw, type NetworkConfig } from "../lib/order";
import { SupplierAgent } from "../lib/supplier";

const MERCHANT_NAME = "Kinnu";
const PORT = 8787;
const AMOUNT_CENTS = 5n;
const MAX_PER_DAY = 40;
const MAX_PER_VISITOR = 2;
const TEN_MINUTES = 10 * 60_000;

const payer = privateKeyToAccount(process.env.PAYER_PRIVATE_KEY as Hex);
const account = privateKeyToAccount(process.env.SUPPLIER_PRIVATE_KEY as Hex);
const chosen = JSON.parse(process.env.HSP_NETWORK_CONFIG as string) as NetworkConfig;
const record = ledger("testnet", payer);

let hsp = await connectHsp();
const call: typeof hsp.call = async (name, args) => {
  try {
    return await hsp.call(name, args);
  } catch (error) {
    if (String(error).includes(`${name} failed`)) throw error;
    hsp = await connectHsp(); // The session can drop while the machine sleeps.
    return hsp.call(name, args);
  }
};

type Flow = {
  supplier: SupplierAgent;
  signed: Awaited<ReturnType<SupplierAgent["requestInvoice"]>>;
  flowId: string;
  paymentRequestId: string;
  prepared: any;
  finalized?: any;
  submitted?: boolean;
  outcome?: { status: string; attributionVerified: boolean; txHash?: string; delivered: boolean; entries: { step: string; url: string }[] };
};
const flows = new Map<string, Flow>();
const visits = new Map<string, number[]>();
let today = { day: "", count: 0 };
let writes: Promise<unknown> = Promise.resolve(); // One sender, so ledger writes go in order.

function allow(visitor: string) {
  const day = new Date().toISOString().slice(0, 10);
  if (today.day !== day) today = { day, count: 0 };
  const recent = (visits.get(visitor) ?? []).filter((t) => Date.now() - t < TEN_MINUTES);
  if (today.count >= MAX_PER_DAY) return "Today's live payments have all been used. The recorded ones are below.";
  if (recent.length >= MAX_PER_VISITOR) return "That's the limit for now. Try again in ten minutes.";
  today.count++;
  visits.set(visitor, [...recent, Date.now()]);
  return null;
}

async function quote() {
  const orderId = `PO-LIVE-${Date.now()}`;
  const description = "Market summary, one live payment";
  const order = { orderId, amountUsdCents: AMOUNT_CENTS, description, work: "Delivered: market summary" };
  const supplier = new SupplierAgent(account, account.address, [order], MERCHANT_NAME);
  const signed = await supplier.requestInvoice(orderId);
  const verdict = await checkInvoice(
    signed,
    [{ orderId, supplier: account.address, amountUsdCents: AMOUNT_CENTS, description }],
    [{ name: "Supplier agent", signer: account.address, knownPayTo: account.address }],
    { paidInvoiceHashes: [], paidInvoiceNumbers: [] },
  );
  if (!verdict.pass) throw new Error("The invoice failed its checks");
  const created = await createOrder(call, MERCHANT_NAME, signed.invoice, description, chosen);
  const { prepared, matches, details } = await prepareOrder({
    call,
    flowId: created.flow_id,
    payer: payer.address,
    protocol: chosen.payment_protocol,
    invoicePayTo: signed.invoice.payTo,
    maxTokenRaw: maxTokenRaw(signed.invoice, chosen.decimals),
  });
  if (!matches) throw new Error("The quote doesn't match the invoice");
  flows.set(created.flow_id, { supplier, signed, flowId: created.flow_id, paymentRequestId: created.payment_request_id, prepared });
  return { flowId: created.flow_id, invoice: signed.invoice.invoiceNumber, amount: "$0.05", token: `${chosen.coin} on ${chosen.network}`, expires: prepared.quote_expires_at, ...details };
}

async function settle(flow: Flow) {
  const result = await pollPayment(call, flow.flowId, flow.paymentRequestId, MERCHANT_NAME);
  const delivery = await flow.supplier.deliver(flow.signed.invoice.invoiceNumber, flow.flowId, call);
  flow.outcome = { status: result.outcome, attributionVerified: result.attributionVerified, txHash: result.txHash, delivered: delivery.delivered, entries: [] };
  appendFileSync("data/run-log.jsonl", JSON.stringify({ kind: "live", invoiceHash: invoiceHash(flow.signed.invoice), supplier: account.address, amountUsdCents: "5", ...result, raw: undefined, delivery, at: new Date().toISOString() }) + "\n");
  if (delivery.delivered && result.txHash) {
    writes = writes.then(async () => {
      flow.outcome!.entries = await record.recordPaid(
        { invoiceHash: invoiceHash(flow.signed.invoice), amountUsdCents: AMOUNT_CENTS, chainId: BigInt(chosen.chain_id), txHash: result.txHash as Hex, paymentRequestId: flow.paymentRequestId, deliveryHash: delivery.deliveryHash },
        account,
      );
    }).catch((error) => console.error("ledger", error));
  }
}

async function route(step: string, body: any, visitor: string) {
  if (step === "quote") {
    const blocked = allow(visitor);
    if (blocked) return { status: 429, json: { error: blocked } };
    return { status: 200, json: await quote() };
  }
  const flow = flows.get(String(body?.flowId));
  if (!flow) return { status: 404, json: { error: "This quote has gone. Start again." } };
  if (step === "sign") {
    flow.finalized ??= await signOrder(call, flow.prepared, (eip712) => payer.signTypedData(eip712));
    return { status: 200, json: { signed: true } };
  }
  if (step === "submit") {
    if (!flow.finalized) return { status: 400, json: { error: "Approve the signature first." } };
    if (!flow.submitted) {
      flow.submitted = true;
      await call("submit_payment", { payment_mandate_json: flow.finalized.payment_mandate_json });
      settle(flow).catch((error) => {
        console.error("settle", error);
        flow.outcome = { status: "payment-failed", attributionVerified: false, delivered: false, entries: [] };
      });
    }
    return { status: 200, json: { submitted: true } };
  }
  if (step === "status") return { status: 200, json: flow.outcome ?? { status: "waiting" } };
  return { status: 404, json: { error: "Unknown step" } };
}

createServer((req, res) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", async () => {
    let answer;
    try {
      if (req.headers["x-relay-key"] !== process.env.RELAY_KEY) throw Object.assign(new Error("Not allowed"), { code: 403 });
      answer = await route(new URL(req.url ?? "/", "http://x").pathname.slice(1), JSON.parse(data || "{}"), String(req.headers["x-visitor"] ?? "unknown"));
    } catch (error: any) {
      console.error(error);
      answer = { status: error?.code === 403 ? 403 : 502, json: { error: "The payment step didn't run. Try again." } };
    }
    res.writeHead(answer.status, { "content-type": "application/json" });
    res.end(JSON.stringify(answer.json));
  });
}).listen(PORT, "127.0.0.1", () => console.log(`relay on ${PORT}, payer ${payer.address}`));
