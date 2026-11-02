import type { Invoice } from "./invoice";

type Call = (name: string, args?: Record<string, unknown>) => Promise<any>;

/** Copied from get_chain_config: the network and token an order is paid with. */
export type NetworkConfig = { network: string; chain_id: number; contract_address: string; coin: string; payment_protocol: "eip3009" | "permit2"; decimals: number };

export function createOrder(call: Call, merchantName: string, invoice: Invoice, label: string, chosen: NetworkConfig) {
  const value = (Number(invoice.amountUsdCents) / 100).toFixed(2);
  return call("create_order", {
    merchant_name: merchantName,
    pay_to: invoice.payTo,
    cart_mandate: {
      contents: {
        id: invoice.invoiceNumber,
        user_cart_confirmation_required: true,
        cart_expiry: new Date(Date.now() + 30 * 60_000).toISOString(),
        payment_request: {
          method_data: [{
            supported_methods: "https://www.x402.org/",
            data: { x402Version: 2, network: chosen.network, chain_id: chosen.chain_id, contract_address: chosen.contract_address, coin: chosen.coin, pay_to: invoice.payTo },
          }],
          details: {
            id: `${invoice.invoiceNumber}-${Date.now()}`,
            display_items: [{ label, amount: { currency: "USD", value } }],
            total: { label: "Total", amount: { currency: "USD", value } },
          },
        },
      },
    },
  });
}

/** The most a quote may ask for: the invoice amount plus 20% for a network fee. */
export const maxTokenRaw = (invoice: Invoice, decimals: number) => (invoice.amountUsdCents * 10n ** BigInt(decimals) * 120n) / 10_000n;
