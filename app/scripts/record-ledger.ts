// Writes the last real HSP payment to InvoiceLedger, plus one stopped test attack, and saves the links for /proof.
//   tsx --env-file=.env scripts/record-ledger.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkInvoice } from "../lib/checks";
import { signInvoice } from "../lib/invoice";

const LEDGER = "0x75466970EB671dF7fA84B1c00f7a00629def0239";
const EXPLORER = "https://testnet-explorer.hskchain.net";
const chain = defineChain({
  id: 133,
  name: "HSK Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet.hsk.xyz"] } },
});
const abi = parseAbi([
  "function stop(bytes32 invoiceHash, address supplier, uint256 reasons)",
  "function approve(bytes32 invoiceHash, address supplier, uint96 amountUsdCents)",
  "function recordPayment(bytes32 invoiceHash, uint256 chainId, bytes32 txHash, string paymentRequestId)",
  "function confirmDelivery(address buyer, bytes32 invoiceHash, bytes32 deliveryHash)",
  "function getInvoice(address buyer, bytes32 invoiceHash) view returns ((address buyer, address supplier, uint96 amountUsdCents, uint8 status))",
]);

const buyer = privateKeyToAccount(process.env.PAYER_PRIVATE_KEY as Hex);
const supplier = privateKeyToAccount(process.env.SUPPLIER_PRIVATE_KEY as Hex);
const reader = createPublicClient({ chain, transport: http() });
const buyerWallet = createWalletClient({ account: buyer, chain, transport: http() });
const supplierWallet = createWalletClient({ account: supplier, chain, transport: http() });

const OUT = "data/ledger.json";
const links: { step: string; url: string }[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).links : [];
const save = () => writeFileSync(OUT, JSON.stringify({ network: "HSK Chain testnet", contract: `${EXPLORER}/address/${LEDGER}`, links }, null, 2) + "\n");
async function done(step: string, hash: Hex) {
  const receipt = await reader.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${step} reverted: ${hash}`);
  links.push({ step, url: `${EXPLORER}/tx/${hash}` });
  console.log(step, hash);
  save();
  // The public RPC can lag a block behind the receipt.
  await new Promise((r) => setTimeout(r, 6000));
}

const lines = readFileSync("data/run-log.jsonl", "utf8").trim().split("\n");
const run = JSON.parse(lines[lines.length - 1]);
if (run.outcome !== "payment-safe" && run.outcome !== "payment-finalized") throw new Error("Last run did not settle");
if (!run.delivery?.delivered) throw new Error("Last run was not delivered");

if ((await reader.getBalance({ address: supplier.address })) < parseEther("0.001")) {
  await reader.waitForTransactionReceipt({ hash: await buyerWallet.sendTransaction({ to: supplier.address, value: parseEther("0.005") }) });
}

const write = (name: "approve" | "recordPayment" | "stop", args: any) =>
  buyerWallet.writeContract({ address: LEDGER, abi, functionName: name, args });

const status = async () => Number((await reader.readContract({ address: LEDGER, abi, functionName: "getInvoice", args: [buyer.address, run.invoiceHash] })).status);
if ((await status()) < 2) await done("Invoice approved", await write("approve", [run.invoiceHash, supplier.address, 100n]));
if ((await status()) < 3) await done("HSP payment recorded", await write("recordPayment", [run.invoiceHash, 11155111n, run.txHash, run.paymentRequestId]));
if ((await status()) < 4) {
  await done(
    "Supplier confirmed delivery",
    await supplierWallet.writeContract({
      address: LEDGER,
      abi,
      functionName: "confirmDelivery",
      args: [buyer.address, run.invoiceHash, run.delivery.deliveryHash],
    }),
  );
}

// A test attack: the supplier signs a real invoice, then someone swaps the payment wallet.
const orderId = "PO-TEST-ATTACK";
const signed = await signInvoice(supplier, {
  invoiceNumber: `INV-${orderId}`,
  orderId,
  supplier: supplier.address,
  payTo: supplier.address,
  amountUsdCents: 100n,
  description: "Market summary",
  issuedAt: BigInt(Math.floor(Date.now() / 1000)),
});
const attacked = { ...signed, invoice: { ...signed.invoice, payTo: buyer.address } };
const verdict = await checkInvoice(
  attacked,
  [{ orderId, supplier: supplier.address, amountUsdCents: 100n, description: "Market summary" }],
  [{ name: "Supplier agent", signer: supplier.address, knownPayTo: supplier.address }],
  { paidInvoiceHashes: [], paidInvoiceNumbers: [] },
);
if (verdict.pass) throw new Error("The test attack passed the checks");
await done("Test attack stopped", await write("stop", [verdict.hash, supplier.address, verdict.reasons]));
