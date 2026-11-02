// Writes every settled payment and stopped attack in the run log to InvoiceLedger, skipping what's already there.
//   tsx --env-file=.env scripts/record-ledger.ts [testnet|mainnet]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { ledger, NETWORKS } from "../lib/ledger";

const network = (process.argv[2] ?? "testnet") as keyof typeof NETWORKS;
const OUT = network === "mainnet" ? "data/ledger-mainnet.json" : "data/ledger.json";
const buyer = privateKeyToAccount((network === "mainnet" ? process.env.DEPLOYER_PRIVATE_KEY : process.env.PAYER_PRIVATE_KEY) as Hex);
const SUPPLIERS = ["SUPPLIER_PRIVATE_KEY", "SUPPLIER_2_PRIVATE_KEY", "SUPPLIER_3_PRIVATE_KEY"].map((k) => privateKeyToAccount(process.env[k] as Hex));
const supplierFor = (address?: string) => SUPPLIERS.find((s) => s.address.toLowerCase() === address?.toLowerCase()) ?? SUPPLIERS[0];

const book = ledger(network, buyer);
const links: { step: string; url: string }[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).links : [];
const done: string[] = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")).done ?? []) : [];
const save = () => writeFileSync(OUT, JSON.stringify({ network: book.net.name, contract: `${book.net.explorer}/address/${book.net.address}`, links, done }, null, 2) + "\n");

const entries = readFileSync("data/run-log.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
for (const e of entries) {
  if (done.includes(e.invoiceHash)) continue;
  if (e.kind === "stopped") {
    links.push(await book.recordStop(e.invoiceHash, e.supplier, BigInt(e.reasons)));
  } else if (e.delivery?.delivered && e.txHash) {
    links.push(...(await book.recordPaid(
      { invoiceHash: e.invoiceHash, amountUsdCents: BigInt(e.amountUsdCents ?? 100), chainId: 11155111n, txHash: e.txHash, paymentRequestId: e.paymentRequestId, deliveryHash: e.delivery.deliveryHash },
      supplierFor(e.supplier),
    )));
  } else continue;
  done.push(e.invoiceHash);
  save();
  console.log("recorded", e.kind ?? "first", e.invoiceHash.slice(0, 12));
}
save();
