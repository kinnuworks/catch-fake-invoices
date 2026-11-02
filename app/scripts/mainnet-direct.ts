// Real HSK payments on mainnet after the same checks, without HSP, whose live networks are test networks.
// Also records attack types beyond the swapped wallet. Skips what's already done.
//   tsx --env-file=.env scripts/mainnet-direct.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { keccak256, parseEther, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkInvoice } from "../lib/checks";
import { invoiceHash, signInvoice } from "../lib/invoice";
import { ledger } from "../lib/ledger";
import { SupplierAgent } from "../lib/supplier";

const AMOUNT = "0.2";
const KEYS = ["SUPPLIER_PRIVATE_KEY", "SUPPLIER_2_PRIVATE_KEY", "SUPPLIER_3_PRIVATE_KEY"];
const OUT = "data/mainnet-direct.json";
const LEDGER = "data/ledger-mainnet.json";
const buyer = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const suppliers = KEYS.map((k) => privateKeyToAccount(process.env[k] as Hex));
const book = ledger("mainnet", buyer);
const state: { payments: unknown[]; stops: unknown[]; done: string[] } = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { payments: [], stops: [], done: [] };
const main = JSON.parse(readFileSync(LEDGER, "utf8"));
const save = () => {
  writeFileSync(OUT, JSON.stringify(state, null, 2) + "\n");
  writeFileSync(LEDGER, JSON.stringify(main, null, 2) + "\n");
};

const WORK = ["Market summary", "Translation of a contract", "Security review of one file", "Dataset cleanup", "Price feed for one day"];
for (let i = 0; i < WORK.length; i++) {
  const key = `pay-${i}`;
  if (state.done.includes(key)) continue;
  const account = suppliers[i % suppliers.length];
  const description = WORK[i];
  const orderId = `MAIN-${Date.now()}-${i}`;
  const work = `Delivered: ${description}`;
  const agent = new SupplierAgent(account, account.address, [{ orderId, amountUsdCents: 2n, description, work }], "Kinnu");
  const signed = await agent.requestInvoice(orderId);
  const orders = [{ orderId, supplier: account.address, amountUsdCents: 2n, description }];
  const known = [{ name: `Supplier ${(i % suppliers.length) + 1}`, signer: account.address, knownPayTo: account.address }];
  const verdict = await checkInvoice(signed, orders, known, { paidInvoiceHashes: [], paidInvoiceNumbers: [] });
  if (!verdict.pass) throw new Error(`Stopped: ${verdict.findings.map((f) => f.message).join(" ")}`);

  const value = parseEther(AMOUNT);
  const hash = await book.wallet(buyer).sendTransaction({ to: account.address, value });
  await book.settled(hash, "payment");
  // The supplier's agent reads the chain itself before it delivers.
  const tx = await book.reader.getTransaction({ hash });
  if (tx.to?.toLowerCase() !== account.address.toLowerCase() || tx.value !== value) throw new Error("Payment doesn't match");
  const entries = await book.recordPaid(
    { invoiceHash: invoiceHash(signed.invoice), amountUsdCents: 2n, chainId: 177n, txHash: hash, paymentRequestId: `direct-${orderId}`, deliveryHash: keccak256(toHex(work)) },
    account,
    "HSK payment recorded",
  );
  main.links.push(...entries);
  state.payments.push({ label: description, amount: `${AMOUNT} HSK`, supplier: account.address, txUrl: `${book.net.explorer}/tx/${hash}`, entries });
  state.done.push(key);
  save();
  console.log("paid", description, hash);
}

const account = suppliers[0];
const orderId = "MAIN-ATTACKS";
const original = { invoiceNumber: "INV-MAIN-ATTACK", orderId, supplier: account.address, payTo: account.address, amountUsdCents: 45_000n, description: "Logo and brand kit", issuedAt: BigInt(Math.floor(Date.now() / 1000)) };
const orders = [{ orderId, supplier: account.address, amountUsdCents: 45_000n, description: "Logo and brand kit" }];
const known = [{ name: "Supplier 1", signer: account.address, knownPayTo: account.address }];
const none = { paidInvoiceHashes: [], paidInvoiceNumbers: [] };
const genuine = await signInvoice(account, original);
const attacks = [
  ["Raised amount", await signInvoice(account, { ...original, invoiceNumber: "INV-MAIN-AMOUNT", amountUsdCents: 54_000n }), none],
  ["Forged supplier", await signInvoice(suppliers[1], { ...original, invoiceNumber: "INV-MAIN-FORGED" }), none],
  ["Duplicate invoice", genuine, { paidInvoiceHashes: [invoiceHash(genuine.invoice)], paidInvoiceNumbers: [genuine.invoice.invoiceNumber] }],
] as const;
for (const [label, signed, history] of attacks) {
  if (state.done.includes(label)) continue;
  const verdict = await checkInvoice(signed, orders, known, history as typeof none);
  if (verdict.pass) throw new Error(`${label} passed the checks`);
  const entry = await book.recordStop(verdict.hash as Hex, account.address, verdict.reasons);
  main.links.push(entry);
  state.stops.push({ label, reasons: verdict.findings.map((f) => f.reason), url: entry.url });
  state.done.push(label);
  save();
  console.log("stopped", label, verdict.findings.map((f) => f.reason).join(","));
}
