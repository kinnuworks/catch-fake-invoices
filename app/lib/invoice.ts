import { getAddress, hashTypedData, recoverTypedDataAddress, type Address, type Hex } from "viem";
import type { LocalAccount } from "viem/accounts";

export type Invoice = {
  invoiceNumber: string;
  orderId: string;
  supplier: Address;
  payTo: Address;
  amountUsdCents: bigint;
  description: string;
  issuedAt: bigint;
};

export type SignedInvoice = { invoice: Invoice; signature: Hex };

const domain = { name: "Invoice", version: "1" } as const;

const types = {
  Invoice: [
    { name: "invoiceNumber", type: "string" },
    { name: "orderId", type: "string" },
    { name: "supplier", type: "address" },
    { name: "payTo", type: "address" },
    { name: "amountUsdCents", type: "uint256" },
    { name: "description", type: "string" },
    { name: "issuedAt", type: "uint256" },
  ],
} as const;

export function invoiceHash(invoice: Invoice): Hex {
  return hashTypedData({ domain, types, primaryType: "Invoice", message: invoice });
}

export async function signInvoice(account: LocalAccount, invoice: Invoice): Promise<SignedInvoice> {
  const signature = await account.signTypedData({ domain, types, primaryType: "Invoice", message: invoice });
  return { invoice, signature };
}

export async function recoverSigner({ invoice, signature }: SignedInvoice): Promise<Address | null> {
  try {
    const signer = await recoverTypedDataAddress({
      domain,
      types,
      primaryType: "Invoice",
      message: invoice,
      signature,
    });
    return getAddress(signer);
  } catch {
    return null;
  }
}
