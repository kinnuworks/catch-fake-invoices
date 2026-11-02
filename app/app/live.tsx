"use client";

import { useState } from "react";
import { WithAddresses } from "./address";

type Quote = { flowId: string; invoice: string; amount: string; token: string; payTo: string; payer: string; tokenTotalRaw: string };
type Outcome = { status: string; attributionVerified?: boolean; txHash?: string; delivered?: boolean; entries?: { step: string; url: string }[] };

const post = async (step: string, body: unknown = {}) => {
  const answer = await fetch(`/api/live/${step}`, { method: "POST", body: JSON.stringify(body) });
  const json = await answer.json().catch(() => ({ error: "offline" }));
  if (!answer.ok) throw new Error(json.error ?? "offline");
  return json;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LivePayment() {
  const [stage, setStage] = useState<"idle" | "quoting" | "sign" | "signing" | "submit" | "settling" | "done">("idle");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState("");

  const guard = async (work: () => Promise<void>, back: typeof stage) => {
    setError("");
    try {
      await work();
    } catch (e) {
      const message = e instanceof Error ? e.message : "offline";
      setError(message === "offline" ? "The live payment machine is offline right now. The recorded payments below are real and you can check them." : message);
      setStage(back);
    }
  };

  const start = () => guard(async () => {
    setStage("quoting");
    setQuote(await post("quote"));
    setStage("sign");
  }, "idle");

  const sign = () => guard(async () => {
    setStage("signing");
    await post("sign", { flowId: quote?.flowId });
    setStage("submit");
  }, "idle");

  const submit = () => guard(async () => {
    setStage("settling");
    await post("submit", { flowId: quote?.flowId });
    for (let i = 0; i < 48; i++) {
      await sleep(5000);
      const now: Outcome = await post("status", { flowId: quote?.flowId });
      if (now.status !== "waiting") {
        setOutcome(now);
        if (!now.txHash || !now.delivered || (now.entries?.length ?? 0) >= 3 || i > 40) {
          setStage("done");
          return;
        }
      }
    }
    setStage("done");
  }, "idle");

  return (
    <div className="card card--flat" id="live" style={{ marginBottom: 32 }}>
      <h3>Make a real payment yourself.</h3>
      <p style={{ marginTop: 8 }}>Our agent pays a supplier's agent 5 cents in test USDC through HSP. No wallet needed. You approve it, as a person always has to.</p>
      {error && <p role="alert" style={{ marginTop: 12 }}>{error}</p>}

      {stage === "idle" && <button className="btn btn-candy" style={{ marginTop: 16 }} onClick={start}>Start a real payment</button>}
      {stage === "quoting" && <p style={{ marginTop: 16 }}>Checking the invoice and asking HSP for a quote…</p>}

      {quote && ["sign", "signing", "submit"].includes(stage) && (
        <div style={{ marginTop: 16 }}>
          <p className="t-small">Invoice {quote.invoice} passed the checks. HSP quoted {quote.amount} in {quote.token}.</p>
          <p className="t-small mono" style={{ marginTop: 8, overflowWrap: "anywhere" }}>Pay to <WithAddresses text={quote.payTo} /><br />Payer <WithAddresses text={quote.payer} /><br />Raw amount {quote.tokenTotalRaw}</p>
          {stage === "sign" && <button className="btn btn-candy" style={{ marginTop: 16 }} onClick={sign}>Approve the signature</button>}
          {stage === "signing" && <p style={{ marginTop: 16 }}>Signing…</p>}
          {stage === "submit" && <button className="btn btn-candy" style={{ marginTop: 16 }} onClick={submit}>Approve and send to HSP</button>}
        </div>
      )}

      {(stage === "settling" || stage === "done") && (
        <div style={{ marginTop: 16 }}>
          {!outcome && <p>HSP is settling it. This usually takes about 3 minutes.</p>}
          {outcome && (
            <ul className="status-list">
              <li><b className={outcome.txHash ? "done" : "todo"}>{outcome.status}</b><span>{outcome.txHash ? <a href={`https://sepolia.etherscan.io/tx/${outcome.txHash}`} style={{ textDecoration: "underline" }}>See your payment on the explorer</a> : "No transaction came back."}</span></li>
              <li><b className={outcome.delivered ? "done" : "todo"}>{outcome.delivered ? "Delivered" : "Not delivered"}</b><span>The supplier's agent asked HSP whether the money arrived before it delivered.</span></li>
              {outcome.entries?.map((e) => <li key={e.url}><b className="done">Recorded</b><span><a href={e.url} style={{ textDecoration: "underline" }}>{e.step}</a> on HSK Chain testnet</span></li>)}
              {stage === "settling" && <li><b className="todo">Writing</b><span>Adding the record to HSK Chain…</span></li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
