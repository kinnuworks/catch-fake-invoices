import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseEther, type Hex } from "viem";
import type { LocalAccount } from "viem/accounts";

const abi = parseAbi([
  "function stop(bytes32 invoiceHash, address supplier, uint256 reasons)",
  "function approve(bytes32 invoiceHash, address supplier, uint96 amountUsdCents)",
  "function recordPayment(bytes32 invoiceHash, uint256 chainId, bytes32 txHash, string paymentRequestId)",
  "function confirmDelivery(address buyer, bytes32 invoiceHash, bytes32 deliveryHash)",
  "function getInvoice(address buyer, bytes32 invoiceHash) view returns ((address buyer, address supplier, uint96 amountUsdCents, uint8 status))",
]);

export const NETWORKS = {
  testnet: { id: 133, name: "HSK Chain testnet", rpc: "https://testnet.hsk.xyz", explorer: "https://testnet-explorer.hskchain.net", address: "0x75466970EB671dF7fA84B1c00f7a00629def0239" as Hex },
  mainnet: { id: 177, name: "HSK Chain mainnet", rpc: "https://mainnet.hsk.xyz", explorer: "https://hsk.blockscout.com", address: (process.env.LEDGER_MAINNET ?? "0x") as Hex },
} as const;

export type LedgerEntry = { step: string; url: string };

export function ledger(network: keyof typeof NETWORKS, buyer: LocalAccount) {
  const net = NETWORKS[network];
  const chain = defineChain({ id: net.id, name: net.name, nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 }, rpcUrls: { default: { http: [net.rpc] } } });
  const reader = createPublicClient({ chain, transport: http() });
  const wallet = (account: LocalAccount) => createWalletClient({ account, chain, transport: http() });
  const base = { address: net.address, abi } as const;

  // The public RPC can lag a block behind the receipt.
  const settled = async (hash: Hex, step: string): Promise<LedgerEntry> => {
    const receipt = await reader.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${step} reverted: ${hash}`);
    await new Promise((r) => setTimeout(r, 6000));
    return { step, url: `${net.explorer}/tx/${hash}` };
  };

  return {
    net,
    async recordPaid(run: { invoiceHash: Hex; amountUsdCents: bigint; chainId: bigint; txHash: Hex; paymentRequestId: string; deliveryHash: Hex }, supplier: LocalAccount) {
      if ((await reader.getBalance({ address: supplier.address })) < parseEther("0.0008")) {
        await settled(await wallet(buyer).sendTransaction({ to: supplier.address, value: parseEther("0.002") }), "gas");
      }
      const status = async () => Number((await reader.readContract({ ...base, functionName: "getInvoice", args: [buyer.address, run.invoiceHash] })).status);
      const entries: LedgerEntry[] = [];
      if ((await status()) < 2) {
        entries.push(await settled(await wallet(buyer).writeContract({ ...base, functionName: "approve", args: [run.invoiceHash, supplier.address, run.amountUsdCents] }), "Invoice approved"));
      }
      if ((await status()) < 3) {
        entries.push(await settled(await wallet(buyer).writeContract({ ...base, functionName: "recordPayment", args: [run.invoiceHash, run.chainId, run.txHash, run.paymentRequestId] }), "HSP payment recorded"));
      }
      if ((await status()) < 4) {
        entries.push(await settled(await wallet(supplier).writeContract({ ...base, functionName: "confirmDelivery", args: [buyer.address, run.invoiceHash, run.deliveryHash] }), "Supplier confirmed delivery"));
      }
      return entries;
    },
    async recordStop(invoiceHash: Hex, supplier: Hex, reasons: bigint) {
      return settled(await wallet(buyer).writeContract({ ...base, functionName: "stop", args: [invoiceHash, supplier, reasons] }), "Attack stopped");
    },
  };
}
