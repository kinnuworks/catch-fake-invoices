import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const HSP_URL = "https://mcp-qa.hashkeymerchant.com/";
export const REQUIRED_TOOLS = [
  "get_chain_config", "create_order", "get_order", "prepare_payment",
  "finalize_payment", "estimate_fee", "submit_payment", "query_payment",
];

/** Statuses at which the guide says to stop polling. payment-safe is not final. */
export const STOP_STATUSES = ["payment-safe", "payment-finalized", "payment-failed"];

export async function connectHsp(url = HSP_URL) {
  const client = new Client({ name: "invoice-buyer-agent", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const { tools } = await client.listTools();
  const missing = REQUIRED_TOOLS.filter((name) => !tools.some((t) => t.name === name));
  if (missing.length) throw new Error(`HSP tools missing: ${missing.join(", ")}`);

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "";
    if (result.isError) throw new Error(`${name} failed: ${text}`);
    return JSON.parse(text);
  };

  return { tools, call, close: () => client.close() };
}
