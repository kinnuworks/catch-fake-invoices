// Turns the local run log into the public list on /proof, asking HSP again for each payment's latest status.
//   tsx --env-file=.env scripts/publish-runs.ts
import { readFileSync, writeFileSync } from "node:fs";
import { pollPayment } from "../lib/flow";
import { connectHsp } from "../lib/hsp";

const MERCHANT_NAME = "Kinnu";
const entries = readFileSync("data/run-log.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const hsp = await connectHsp();
const paid = [];
for (const e of entries) {
  if (!e.txHash || !e.flowId) continue;
  // If the gateway won't answer for an older payment, keep what it said when the payment settled.
  const now = await pollPayment(hsp.call, e.flowId, e.paymentRequestId, MERCHANT_NAME, 0, 1).catch(() => null);
  const payment = (now?.raw as any)?.payment ?? e.raw?.payment ?? {};
  paid.push({
    label: e.description ?? "Market summary",
    amount: `$${(Number(e.amountUsdCents ?? 100) / 100).toFixed(2)}`,
    source: e.source ?? (e.kind === "live" ? "live button" : "signed invoice"),
    status: payment.status ?? e.outcome,
    attributionVerified: now?.attributionVerified || e.attributionVerified,
    delivered: !!e.delivery?.delivered,
    supplier: e.supplier ?? payment.to_pay_address,
    network: "Ethereum Sepolia, test USDC",
    txUrl: `https://sepolia.etherscan.io/tx/${e.txHash}`,
    at: e.at,
    timeline: [
      ["Order created, cart mandate signed by HSP", payment.created_at],
      ["Payment mandate signed and sent to the gateway", payment.broadcast_at],
      ["In a block", payment.included_at],
      [`Latest status: ${payment.status}`, null],
    ].filter(([, at], i) => at || i === 3),
  });
}
await hsp.close();
writeFileSync("data/runs.json", JSON.stringify(paid, null, 2) + "\n");
const stopped = entries.filter((e) => e.kind === "stopped").length;
console.log(`${paid.length} payments, ${stopped} stopped, statuses: ${[...new Set(paid.map((p) => p.status))].join(", ")}, suppliers: ${new Set(paid.map((p) => p.supplier)).size}`);
