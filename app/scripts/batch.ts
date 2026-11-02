// A batch of real HSP payments from three supplier agents, with attacks stopped along the way.
// Asks twice before each payment, then waits for them all to settle.
//   tsx --env-file=.env scripts/batch.ts <count>
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { checkInvoice } from "../lib/checks";
import { payOrder, pollPayment } from "../lib/flow";
import { connectHsp } from "../lib/hsp";
import { invoiceHash } from "../lib/invoice";
import { invoiceToPdf } from "../lib/invoicePdf";
import { reviewInvoice } from "../lib/readInvoice";
import { createOrder, maxTokenRaw } from "../lib/order";
import { SupplierAgent } from "../lib/supplier";

const MERCHANT_NAME = "Kinnu";
const key = (name: string) => privateKeyToAccount(process.env[name] as Hex);
const payer = key("PAYER_PRIVATE_KEY");
const accounts = [key("SUPPLIER_PRIVATE_KEY"), key("SUPPLIER_2_PRIVATE_KEY"), key("SUPPLIER_3_PRIVATE_KEY")];
const WORK = [
  ["Market summary", 25n],
  ["Translation of a contract", 40n],
  ["Security review of one file", 50n],
  ["Dataset cleanup", 15n],
  ["Logo variations", 30n],
  ["Price feed for one day", 5n],
] as const;

const count = Number(process.argv[2] ?? 3);
const chosen = JSON.parse(process.env.HSP_NETWORK_CONFIG as string);
const hsp = await connectHsp();
const ask = createInterface({ input: process.stdin, output: process.stdout });
const log = (record: unknown) => appendFileSync("data/run-log.jsonl", JSON.stringify(record, (_, v) => (typeof v === "bigint" ? v.toString() : v)) + "\n");

const submitted = [];
for (let i = 0; i < count; i++) {
  const account = accounts[i % accounts.length];
  const [description, amountUsdCents] = WORK[i % WORK.length];
  const orderId = `PO-${Date.now()}-${i}`;
  const order = { orderId, amountUsdCents, description, work: `Delivered: ${description}` };
  const supplier = new SupplierAgent(account, account.address, [order], MERCHANT_NAME);
  const signed = await supplier.requestInvoice(orderId);
  const orders = [{ orderId, supplier: account.address, amountUsdCents, description }];
  const known = [{ name: `Supplier ${(i % accounts.length) + 1}`, signer: account.address, knownPayTo: account.address }];
  const history = { paidInvoiceHashes: [], paidInvoiceNumbers: [] };

  // Every fifth run, the same invoice arrives first with its wallet swapped.
  if (i % 5 === 0) {
    const attacked = { ...signed, invoice: { ...signed.invoice, payTo: payer.address } };
    const verdict = await checkInvoice(attacked, orders, known, history);
    if (verdict.pass) throw new Error("The swapped wallet passed the checks");
    console.log(`\n#${i + 1} swapped wallet: stopped (${verdict.findings.map((f) => f.reason).join(", ")})`);
    log({ kind: "stopped", invoiceHash: verdict.hash, supplier: account.address, reasons: verdict.reasons, at: new Date().toISOString() });
  }

  const verdict = await checkInvoice(signed, orders, known, history);
  if (!verdict.pass) throw new Error(`Stopped: ${verdict.findings.map((f) => f.message).join(" ")}`);

  // Every third run starts from the PDF the supplier attached, not the signed data alone.
  const fromPdf = i % 3 === 0;
  if (fromPdf) {
    const review = await reviewInvoice(await invoiceToPdf(signed.invoice), { payTo: signed.invoice.payTo, amount: Number(amountUsdCents) / 100 });
    if (review.warnings.length) throw new Error(`PDF stopped: ${review.warnings.map((w) => w.message).join(" ")}`);
  }

  const created = await createOrder(hsp.call, MERCHANT_NAME, signed.invoice, description, chosen);
  const result = await payOrder({
    call: hsp.call,
    flowId: created.flow_id,
    paymentRequestId: created.payment_request_id,
    payer: payer.address,
    protocol: chosen.payment_protocol,
    merchantName: MERCHANT_NAME,
    invoicePayTo: signed.invoice.payTo,
    maxTokenRaw: maxTokenRaw(signed.invoice, chosen.decimals),
    maxPolls: 0,
    approve: async (a) => {
      console.log(`\n#${i + 1}/${count} ${description}, before ${a.step}: pay to ${a.payTo}, payer ${a.payer}, raw amount ${a.tokenTotalRaw}`);
      return (await ask.question("Type yes to approve: ")).trim() === "yes";
    },
    signTypedData: (eip712) => payer.signTypedData(eip712),
  });
  if (result.outcome !== "pending") {
    console.log(`#${i + 1}: ${result.outcome}, nothing sent`);
    continue;
  }
  submitted.push({ i, created, supplier, signed, account, fromPdf });
}
ask.close();

console.log(`\nSubmitted ${submitted.length}. Waiting for them to settle.`);
await Promise.all(
  submitted.map(async ({ i, created, supplier, signed, account, fromPdf }) => {
    const result = await pollPayment(hsp.call, created.flow_id, created.payment_request_id, MERCHANT_NAME);
    const delivery = await supplier.deliver(signed.invoice.invoiceNumber, created.flow_id, hsp.call);
    log({ kind: "paid", source: fromPdf ? "PDF invoice" : "signed invoice", invoiceHash: invoiceHash(signed.invoice), supplier: account.address, amountUsdCents: signed.invoice.amountUsdCents, description: signed.invoice.description, ...result, delivery, at: new Date().toISOString() });
    console.log(`#${i + 1}: ${result.outcome} | attribution ${result.attributionVerified} | delivered ${delivery.delivered} | ${result.txHash ?? "no tx"}`);
  }),
);
await hsp.close();
