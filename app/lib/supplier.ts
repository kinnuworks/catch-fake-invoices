import { keccak256, toHex, type Address } from "viem";
import type { LocalAccount } from "viem/accounts";
import { supplierVerifies } from "./flow";
import { signInvoice, type SignedInvoice } from "./invoice";

export type SupplierOrder = { orderId: string; amountUsdCents: bigint; description: string; work: string };

type Call = (name: string, args?: Record<string, unknown>) => Promise<any>;

/** The receiving agent: it sets the payment conditions, and hands over the work only after checking the gateway itself. */
export class SupplierAgent {
  private issued = new Map<string, SupplierOrder>();
  private delivered = new Set<string>();
  private counter = 0;

  constructor(
    private account: LocalAccount,
    private payTo: Address,
    private orders: SupplierOrder[],
    private merchantName: string,
  ) {}

  async requestInvoice(orderId: string, now = BigInt(Math.floor(Date.now() / 1000))): Promise<SignedInvoice> {
    const order = this.orders.find((o) => o.orderId === orderId);
    if (!order) throw new Error(`No order ${orderId}`);
    const invoiceNumber = `INV-${orderId}-${++this.counter}`;
    this.issued.set(invoiceNumber, order);
    return signInvoice(this.account, {
      invoiceNumber,
      orderId,
      supplier: this.account.address,
      payTo: this.payTo,
      amountUsdCents: order.amountUsdCents,
      description: order.description,
      issuedAt: now,
    });
  }

  async deliver(invoiceNumber: string, flowId: string, call: Call) {
    const order = this.issued.get(invoiceNumber);
    if (!order) return { delivered: false as const, reason: "This agent didn't issue that invoice." };
    if (this.delivered.has(invoiceNumber)) return { delivered: false as const, reason: "Already delivered." };
    if (!(await supplierVerifies(call, flowId, this.merchantName, this.payTo))) {
      return { delivered: false as const, reason: "The gateway doesn't show this payment on-chain, attributed and sent to this wallet." };
    }
    this.delivered.add(invoiceNumber);
    return { delivered: true as const, work: order.work, deliveryHash: keccak256(toHex(order.work)) };
  }
}
