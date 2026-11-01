import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { checkInvoice, type Finding, type Order, type Supplier } from "./checks";
import { SCENARIOS } from "./demo-labels";
import { signInvoice, type Invoice } from "./invoice";

export { SCENARIOS };
export type Scenario = keyof typeof SCENARIOS;

export type DemoResult = {
  scenario: Scenario;
  invoice: { number: string; order: string; supplier: string; payTo: string; amount: string; description: string };
  changed: string[];
  hash: string;
  pass: boolean;
  findings: Finding[];
};

// Demo keys hold no funds and last only as long as the server process.
const supplierAgent = privateKeyToAccount(generatePrivateKey());
const impostor = privateKeyToAccount(generatePrivateKey());
const supplierWallet = privateKeyToAccount(generatePrivateKey()).address;
const attackerWallet = privateKeyToAccount(generatePrivateKey()).address;

const suppliers: Supplier[] = [{ name: "Meera Design Studio", signer: supplierAgent.address, knownPayTo: supplierWallet }];
const orders: Order[] = [
  { orderId: "PO-1042", supplier: supplierAgent.address, amountUsdCents: 45_000n, description: "Logo and brand kit" },
];
const original: Invoice = {
  invoiceNumber: "INV-2207",
  orderId: "PO-1042",
  supplier: supplierAgent.address,
  payTo: supplierWallet,
  amountUsdCents: 45_000n,
  description: "Logo and brand kit",
  issuedAt: 1_793_000_000n,
};

export async function runScenario(scenario: Scenario): Promise<DemoResult> {
  let signed = await signInvoice(supplierAgent, original);
  let changed: string[] = [];
  let paidNumbers: string[] = [];

  if (scenario === "wallet") {
    signed = await signInvoice(supplierAgent, { ...original, payTo: attackerWallet });
    changed = ["payTo"];
  } else if (scenario === "amount") {
    signed = await signInvoice(supplierAgent, { ...original, amountUsdCents: 54_000n });
    changed = ["amount"];
  } else if (scenario === "edited") {
    signed = { ...signed, invoice: { ...original, payTo: attackerWallet } };
    changed = ["payTo"];
  } else if (scenario === "forged") {
    signed = await signInvoice(impostor, original);
    changed = ["signature"];
  } else if (scenario === "duplicate") {
    paidNumbers = [original.invoiceNumber];
  }

  const verdict = await checkInvoice(signed, orders, suppliers, { paidInvoiceHashes: [], paidInvoiceNumbers: paidNumbers });
  const i = signed.invoice;
  return {
    scenario,
    invoice: {
      number: i.invoiceNumber,
      order: i.orderId,
      supplier: suppliers[0].name,
      payTo: i.payTo,
      amount: `$${(Number(i.amountUsdCents) / 100).toFixed(2)}`,
      description: i.description,
    },
    changed,
    hash: verdict.hash,
    pass: verdict.pass,
    findings: verdict.findings,
  };
}
