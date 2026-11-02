// The real loop against the HSP QA gateway. Run only after allowlisting is confirmed:
//   pnpm exec tsx --env-file=.env scripts/run-loop.ts schema     prints the live tools and schemas, pays nothing
//   pnpm exec tsx --env-file=.env scripts/run-loop.ts pay        runs one payment, asking twice before money moves
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { privateKeyToAccount } from "viem/accounts";
import { checkInvoice } from "../lib/checks";
import { payOrder } from "../lib/flow";
import { createOrder } from "../lib/order";
import { connectHsp } from "../lib/hsp";
import { invoiceHash } from "../lib/invoice";
import { SupplierAgent } from "../lib/supplier";

const MERCHANT_NAME = "Kinnu";
const need = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in app/.env`);
  return value;
};

const hsp = await connectHsp();
if (process.argv[2] === "schema") {
  for (const tool of hsp.tools) console.log(tool.name, JSON.stringify(tool.inputSchema, null, 1), "\n", tool.description);
  console.log(JSON.stringify(await hsp.call("get_chain_config"), null, 1));
  await hsp.close();
  process.exit(0);
}

const payer = privateKeyToAccount(need("PAYER_PRIVATE_KEY") as `0x${string}`);
const supplierKey = privateKeyToAccount(need("SUPPLIER_PRIVATE_KEY") as `0x${string}`);
const supplierWallet = supplierKey.address;
const orderId = `PO-${Date.now()}`;
const order = { orderId, amountUsdCents: 100n, description: "Market summary", work: "Delivered: market summary" };
const supplier = new SupplierAgent(supplierKey, supplierWallet, [order], MERCHANT_NAME);

const signed = await supplier.requestInvoice(orderId);
const verdict = await checkInvoice(
  signed,
  [{ orderId, supplier: supplierKey.address, amountUsdCents: 100n, description: order.description }],
  [{ name: "Supplier agent", signer: supplierKey.address, knownPayTo: supplierWallet }],
  { paidInvoiceHashes: [], paidInvoiceNumbers: [] },
);
if (!verdict.pass) throw new Error(`Stopped: ${verdict.findings.map((f) => f.message).join(" ")}`);

const config = await hsp.call("get_chain_config");
const chosen = JSON.parse(need("HSP_NETWORK_CONFIG")); // {network, chain_id, contract_address, coin, payment_protocol, decimals}, copied from the schema output
const value = (Number(signed.invoice.amountUsdCents) / 100).toFixed(2);
const created = await createOrder(hsp.call, MERCHANT_NAME, signed.invoice, order.description, chosen);

const ask = createInterface({ input: process.stdin, output: process.stdout });
const result = await payOrder({
  call: hsp.call,
  flowId: created.flow_id,
  paymentRequestId: created.payment_request_id,
  payer: payer.address,
  protocol: chosen.payment_protocol,
  merchantName: MERCHANT_NAME,
  invoicePayTo: signed.invoice.payTo,
  // A dollar of a 6-decimal stablecoin, plus up to 20% for a network fee the quote may include.
  maxTokenRaw: (signed.invoice.amountUsdCents * 10n ** BigInt(chosen.decimals) * 120n) / 10_000n,
  approve: async (a) => {
    console.log(`\nBefore ${a.step}: pay to ${a.payTo}, payer ${a.payer}, raw amount ${a.tokenTotalRaw}`);
    return (await ask.question("Type yes to approve: ")).trim() === "yes";
  },
  signTypedData: (eip712) => payer.signTypedData(eip712),
});
ask.close();

const delivery = await supplier.deliver(signed.invoice.invoiceNumber, created.flow_id, hsp.call);
const record = { invoiceHash: invoiceHash(signed.invoice), chainConfigChecked: !!config, ...result, delivery, at: new Date().toISOString() };
appendFileSync("data/run-log.jsonl", JSON.stringify(record, (_, v) => (typeof v === "bigint" ? v.toString() : v)) + "\n");
console.log("\nHSP result:", result.outcome, "| attribution verified:", result.attributionVerified, "| tx:", result.txHash ?? "unavailable");
console.log("Supplier agent:", delivery);
await hsp.close();
